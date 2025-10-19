import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  workspaceProcedure,
} from "~/server/api/trpc";
import { memberships, workspaces } from "~/server/db/schema";

export const workspaceRouter = createTRPCRouter({
  /**
   * Get all workspaces for the current user
   */
  getMyWorkspaces: protectedProcedure.query(async ({ ctx }) => {
    const userMemberships = await ctx.db
      .select({
        workspace: workspaces,
        membership: memberships,
      })
      .from(memberships)
      .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
      .where(eq(memberships.userId, ctx.session.user.id));

    return userMemberships.map((m) => ({
      ...m.workspace,
      role: m.membership.role,
    }));
  }),

  /**
   * Get workspace by ID
   */
  getById: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string().optional(),
      }),
    )
    .query(async ({ ctx }) => {
      return ctx.workspace;
    }),

  /**
   * Update workspace settings
   */
  update: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string().optional(),
        name: z.string().min(1).max(255).optional(),
        logoUrl: z.string().url().optional().nullable(),
        primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        customDomain: z.string().max(255).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Only owners can update workspace settings
      if (ctx.membership.role !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only workspace owners can update settings",
        });
      }

      const updateData: Record<string, string | null | undefined> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.logoUrl !== undefined) updateData.logoUrl = input.logoUrl;
      if (input.primaryColor !== undefined) updateData.primaryColor = input.primaryColor;
      if (input.customDomain !== undefined) {
        // Check if custom domain is already taken by another workspace
        if (input.customDomain) {
          const existing = await ctx.db
            .select()
            .from(workspaces)
            .where(eq(workspaces.customDomain, input.customDomain))
            .limit(1);

          if (existing.length > 0 && existing[0]!.id !== ctx.workspace.id) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "This custom domain is already in use",
            });
          }
        }
        updateData.customDomain = input.customDomain;
      }

      if (Object.keys(updateData).length === 0) {
        return ctx.workspace;
      }

      const updated = await ctx.db
        .update(workspaces)
        .set(updateData)
        .where(eq(workspaces.id, ctx.workspace.id))
        .returning();

      return updated[0];
    }),

  /**
   * Create a new workspace
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if slug is already taken
      const existing = await ctx.db
        .select()
        .from(workspaces)
        .where(eq(workspaces.slug, input.slug))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This workspace slug is already taken",
        });
      }

      // Create workspace
      const newWorkspaces = await ctx.db
        .insert(workspaces)
        .values({
          name: input.name,
          slug: input.slug,
          ownerId: ctx.session.user.id,
          credits: 1, // Default free credit
        })
        .returning();

      const workspace = newWorkspaces[0]!;

      // Create membership
      await ctx.db.insert(memberships).values({
        userId: ctx.session.user.id,
        workspaceId: workspace.id,
        role: "owner",
      });

      return workspace;
    }),
});

