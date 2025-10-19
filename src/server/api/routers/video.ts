import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  workspaceProcedure,
} from "~/server/api/trpc";
import { videoJobs, workspaces } from "~/server/db/schema";
import { addVideoProcessingJob } from "~/server/queue";
import {
  generatePresignedDownloadUrl,
  generatePresignedUploadUrl,
} from "~/server/storage/r2";

const MAX_FILE_SIZE = 300 * 1024 * 1024; // 300MB

export const videoRouter = createTRPCRouter({
  /**
   * Create a presigned upload URL for a video
   */
  createUploadUrl: workspaceProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(255),
        fileSize: z.number().min(1).max(MAX_FILE_SIZE),
        fileType: z.string().optional(),
        workspaceId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if workspace has credits
      if (ctx.workspace.credits <= 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Insufficient credits. Please purchase more credits to continue.",
        });
      }

      // Validate file size
      if (input.fileSize > MAX_FILE_SIZE) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `File size exceeds maximum allowed size of 300MB`,
        });
      }

      // Generate unique job ID
      const jobId = crypto.randomUUID();
      const fileKey = `videos/input/${ctx.workspace.id}/${jobId}/${input.filename}`;

      // Determine content type
      const contentType = input.fileType || "application/octet-stream";

      // Generate presigned upload URL (valid for 1 hour)
      const uploadUrl = await generatePresignedUploadUrl(fileKey, contentType, 3600);

      return {
        jobId,
        uploadUrl,
        fileKey,
        contentType,
      };
    }),

  /**
   * Confirm upload and start processing
   */
  confirmUpload: workspaceProcedure
    .input(
      z.object({
        jobId: z.string().uuid(),
        fileKey: z.string(),
        filename: z.string(),
        fileSize: z.number(),
        workspaceId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Double-check credits again
      if (ctx.workspace.credits <= 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Insufficient credits",
        });
      }

      // Create video job record
      await ctx.db.insert(videoJobs).values({
        id: input.jobId,
        workspaceId: ctx.workspace.id,
        userId: ctx.session.user.id,
        status: "queued",
        inputFileKey: input.fileKey,
        originalFilename: input.filename,
        fileSize: input.fileSize,
      });

      // Decrement workspace credits
      await ctx.db
        .update(workspaces)
        .set({ credits: ctx.workspace.credits - 1 })
        .where(eq(workspaces.id, ctx.workspace.id));

      // Add job to queue
      await addVideoProcessingJob({
        jobId: input.jobId,
        workspaceId: ctx.workspace.id,
        userId: ctx.session.user.id,
        inputFileKey: input.fileKey,
        originalFilename: input.filename,
      });

      return {
        success: true,
        jobId: input.jobId,
      };
    }),

  /**
   * Get all video jobs for the current workspace
   */
  getJobs: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const jobs = await ctx.db
        .select()
        .from(videoJobs)
        .where(eq(videoJobs.workspaceId, ctx.workspace.id))
        .orderBy(desc(videoJobs.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return jobs;
    }),

  /**
   * Get a specific video job with download URL if completed
   */
  getJobStatus: workspaceProcedure
    .input(
      z.object({
        jobId: z.string().uuid(),
        workspaceId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const jobs = await ctx.db
        .select()
        .from(videoJobs)
        .where(
          and(
            eq(videoJobs.id, input.jobId),
            eq(videoJobs.workspaceId, ctx.workspace.id)
          )
        )
        .limit(1);

      if (jobs.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Job not found",
        });
      }

      const job = jobs[0]!;

      // Generate download URL if job is completed
      let downloadUrl = null;
      if (job.status === "completed" && job.outputFileKey) {
        downloadUrl = await generatePresignedDownloadUrl(job.outputFileKey, 86400); // 24 hours
      }

      return {
        ...job,
        downloadUrl,
      };
    }),

  /**
   * Get current workspace credits
   */
  getCredits: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string().optional(),
      }),
    )
    .query(async ({ ctx }) => {
      return {
        credits: ctx.workspace.credits,
      };
    }),

  /**
   * Retry a failed video job
   */
  retryJob: workspaceProcedure
    .input(
      z.object({
        jobId: z.string().uuid(),
        workspaceId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get the failed job
      const jobs = await ctx.db
        .select()
        .from(videoJobs)
        .where(
          and(
            eq(videoJobs.id, input.jobId),
            eq(videoJobs.workspaceId, ctx.workspace.id)
          )
        )
        .limit(1);

      if (jobs.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Job not found",
        });
      }

      const job = jobs[0]!;

      // Only allow retrying failed jobs
      if (job.status !== "failed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only failed jobs can be retried",
        });
      }

      // Check if workspace has credits
      if (ctx.workspace.credits <= 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Insufficient credits. Please purchase more credits to retry.",
        });
      }

      // Reset job status to queued and clear error
      await ctx.db
        .update(videoJobs)
        .set({
          status: "queued",
          error: null,
          completedAt: null,
          outputFileKey: null,
        })
        .where(eq(videoJobs.id, input.jobId));

      // Re-add job to queue
      await addVideoProcessingJob({
        jobId: job.id,
        workspaceId: job.workspaceId,
        userId: job.userId,
        inputFileKey: job.inputFileKey,
        originalFilename: job.originalFilename,
      });

      // Decrement workspace credits
      await ctx.db
        .update(workspaces)
        .set({ credits: ctx.workspace.credits - 1 })
        .where(eq(workspaces.id, ctx.workspace.id));

      return {
        success: true,
        jobId: input.jobId,
      };
    }),
});

