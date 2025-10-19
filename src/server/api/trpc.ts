/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import superjson from "superjson";
import { ZodError } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { memberships, workspaces } from "~/server/db/schema";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();
  const customDomain = opts.headers.get("x-custom-domain");

  // Resolve workspace from custom domain
  let workspace = null;
  if (customDomain) {
    const workspaceResults = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.customDomain, customDomain))
      .limit(1);
    workspace = workspaceResults[0] ?? null;
  }

  return {
    db,
    session,
    workspace,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });

/**
 * Workspace procedure
 *
 * Ensures the user is authenticated and has access to a workspace. If on a custom domain,
 * the workspace is resolved from the domain. Otherwise, you need to pass workspaceId.
 */
export const workspaceProcedure = protectedProcedure.use(
  async ({ ctx, next, input }) => {
    const typedInput = input as { workspaceId?: string } | undefined;
    let workspaceId = typedInput?.workspaceId ?? ctx.workspace?.id;

    // If no workspace in context and no workspaceId provided, get user's first workspace
    if (!workspaceId) {
      const userMemberships = await ctx.db
        .select({ workspaceId: memberships.workspaceId })
        .from(memberships)
        .where(eq(memberships.userId, ctx.session.user.id))
        .limit(1);

      if (userMemberships.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No workspace found for user",
        });
      }
      workspaceId = userMemberships[0]!.workspaceId;
    }

    // Verify user has access to this workspace
    const membership = await ctx.db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, ctx.session.user.id),
          eq(memberships.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You don't have access to this workspace",
      });
    }

    // Get full workspace data
    const workspaceData = await ctx.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (workspaceData.length === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Workspace not found",
      });
    }

    return next({
      ctx: {
        workspace: workspaceData[0]!,
        membership: membership[0]!,
      },
    });
  },
);
