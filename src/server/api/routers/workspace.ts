import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import dns from "dns/promises";

import {
  createTRPCRouter,
  protectedProcedure,
  workspaceProcedure,
} from "~/server/api/trpc";
import { memberships, workspaces } from "~/server/db/schema";
import { env } from "~/env";

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
        primaryColor: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
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
      if (input.primaryColor !== undefined)
        updateData.primaryColor = input.primaryColor;
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
        slug: z
          .string()
          .min(1)
          .max(255)
          .regex(/^[a-z0-9-]+$/),
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

 
  reserveSubdomain: workspaceProcedure
    .input(
      z.object({
        subdomain: z
          .string()
          .min(3, "Subdomain must be at least 3 characters")
          .max(63, "Subdomain must be less than 63 characters")
          .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens allowed"),
        workspaceId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.membership.role !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only workspace owners can reserve subdomains",
        });
      }

      // Base domain - configure this based on your wildcard domain in Railway
      // Example: If you added *.videoproc.app to Railway, use "videoproc.app"
      const baseDomain = process.env.BASE_DOMAIN || "yourdomain.com";
      const fullDomain = `${input.subdomain}.${baseDomain}`;

      // Check if subdomain is already taken
      const existing = await ctx.db
        .select()
        .from(workspaces)
        .where(eq(workspaces.customDomain, fullDomain))
        .limit(1);

      if (existing.length > 0 && existing[0]!.id !== ctx.workspace.id) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This subdomain is already taken. Please try another.",
        });
      }

      // Reserved subdomains (prevent conflicts)
      const reserved = ["www", "api", "app", "admin", "dashboard", "cdn", "static", "assets", "mail", "blog"];
      if (reserved.includes(input.subdomain)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This subdomain is reserved. Please choose another.",
        });
      }

      // Instantly activate (no DNS verification needed for subdomains)
      await ctx.db
        .update(workspaces)
        .set({ customDomain: fullDomain })
        .where(eq(workspaces.id, ctx.workspace.id));

      return {
        success: true,
        domain: fullDomain,
        url: `https://${fullDomain}`,
        message: "Subdomain activated instantly!",
      };
    }),

  /**
   * Check if subdomain is available
   */
  checkSubdomainAvailability: protectedProcedure
    .input(
      z.object({
        subdomain: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const baseDomain = process.env.BASE_DOMAIN || "yourdomain.com";
      const fullDomain = `${input.subdomain}.${baseDomain}`;

      const reserved = ["www", "api", "app", "admin", "dashboard", "cdn", "static", "assets", "mail", "blog"];
      if (reserved.includes(input.subdomain)) {
        return {
          available: false,
          domain: fullDomain,
          reason: "reserved",
        };
      }

      const existing = await ctx.db
        .select()
        .from(workspaces)
        .where(eq(workspaces.customDomain, fullDomain))
        .limit(1);

      return {
        available: existing.length === 0,
        domain: fullDomain,
        reason: existing.length > 0 ? "taken" : undefined,
      };
    }),

  /**
   * Verify custom domain DNS configuration (for bring-your-own-domain feature)
   */
  verifyDomain: workspaceProcedure
    .input(
      z.object({
        domain: z.string().min(1).max(255),
        workspaceId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.membership.role !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only workspace owners can verify domains",
        });
      }

      const domain = input.domain.toLowerCase().trim();

      const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/;
      if (!domainRegex.test(domain)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid domain format",
        });
      }

      const existing = await ctx.db
        .select()
        .from(workspaces)
        .where(eq(workspaces.customDomain, domain))
        .limit(1);

      if (existing.length > 0 && existing[0]!.id !== ctx.workspace.id) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This domain is already in use by another workspace",
        });
      }

      const appUrl = env.NEXT_PUBLIC_APP_URL || env.NEXTAUTH_URL;
      const expectedTarget = appUrl.replace(/^https?:\/\//, "").split(":")[0];

      try {
        const records = await dns.resolveCname(domain).catch(() => null);

        if (!records || records.length === 0) {
          const aRecords = await dns.resolve4(domain).catch(() => null);
          
          if (!aRecords) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `DNS verification failed. Please add a CNAME record pointing to ${expectedTarget}`,
            });
          }

          console.log(`Domain ${domain} uses A record instead of CNAME`);
        } else {
          const cnameTarget = records[0]?.toLowerCase();
          if (!cnameTarget?.includes(expectedTarget ?? "")) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `CNAME record points to ${cnameTarget} instead of ${expectedTarget}`,
            });
          }
        }

        await ctx.db
          .update(workspaces)
          .set({ customDomain: domain })
          .where(eq(workspaces.id, ctx.workspace.id));

        return {
          success: true,
          domain,
          message: "Domain verified successfully!",
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error("DNS verification error:", error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `DNS verification failed. Please ensure ${domain} has a CNAME record pointing to ${expectedTarget}`,
        });
      }
    }),


  removeDomain: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx }) => {
      // Only owners can remove domains
      if (ctx.membership.role !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only workspace owners can remove domains",
        });
      }

      await ctx.db
        .update(workspaces)
        .set({ customDomain: null })
        .where(eq(workspaces.id, ctx.workspace.id));

      return {
        success: true,
        message: "Custom domain removed",
      };
    }),

 
  getDomainInstructions: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string().optional(),
      }),
    )
    .query(async ({ ctx }) => {
      const appUrl = env.NEXT_PUBLIC_APP_URL || env.NEXTAUTH_URL;
      const appDomain = appUrl.replace(/^https?:\/\//, "").split(":")[0];

      return {
        appDomain,
        cnameTarget: appDomain,
        instructions: [
          `Go to your DNS provider (Cloudflare, GoDaddy, etc.)`,
          `Add a CNAME record:`,
          `  - Type: CNAME`,
          `  - Name: videos (or your subdomain)`,
          `  - Value: ${appDomain}`,
          `  - TTL: Auto or 3600`,
          `Wait 5-60 minutes for DNS propagation`,
          `Come back and click "Verify Domain"`,
        ],
      };
    }),
});
