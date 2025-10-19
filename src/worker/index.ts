import { workerEnv } from "./env";

import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { createWriteStream, existsSync, mkdirSync } from "fs";
import { unlink } from "fs/promises";
import Redis from "ioredis";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";
import { finished } from "stream/promises";
import { spawn } from "child_process";

import { db } from "~/server/db";
import { users, videoJobs, workspaces } from "~/server/db/schema";
import { sendVideoCompletedEmail, sendVideoFailedEmail } from "~/server/email";
import { type VideoProcessingJobData } from "~/server/queue";
import { getFileStream, uploadFile } from "~/server/storage/r2";

// Redis connection for worker
const connection = new Redis(workerEnv.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Create temp directory if it doesn't exist
const TEMP_DIR = join(tmpdir(), "video-processor");
if (!existsSync(TEMP_DIR)) {
  mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Download file from R2 to local temp directory
 */
async function downloadFromR2(key: string, outputPath: string): Promise<void> {
  const stream = await getFileStream(key);
  if (!stream) {
    throw new Error("Failed to get file stream from R2");
  }

  const fileStream = createWriteStream(outputPath);
  await finished(Readable.from(stream as any).pipe(fileStream));
}

/**
 * Parse FFmpeg silence detection output
 */
function parseSilenceDetection(
  stderr: string,
): Array<{ start: number; end: number }> {
  const silences: Array<{ start: number; end: number }> = [];
  const lines = stderr.split("\n");

  let currentSilence: { start?: number; end?: number } = {};

  const startRegex = /silence_start: ([\d.]+)/;
  const endRegex = /silence_end: ([\d.]+)/;

  for (const line of lines) {
    const startMatch = startRegex.exec(line);
    const endMatch = endRegex.exec(line);

    if (startMatch) {
      currentSilence.start = parseFloat(startMatch[1]!);
    }
    if (endMatch) {
      currentSilence.end = parseFloat(endMatch[1]!);
      if (currentSilence.start !== undefined) {
        silences.push({
          start: currentSilence.start,
          end: currentSilence.end,
        });
        currentSilence = {};
      }
    }
  }

  return silences;
}

/**
 * Get video duration using FFprobe
 */
async function getVideoDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ]);

    let stdout = "";
    let stderr = "";

    ffprobe.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`FFprobe failed: ${stderr}`));
      } else {
        resolve(parseFloat(stdout.trim()));
      }
    });
  });
}

/**
 * Detect silences in video using FFmpeg
 */
async function detectSilences(
  inputPath: string,
): Promise<Array<{ start: number; end: number }>> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      inputPath,
      "-af",
      "silencedetect=noise=-30dB:d=0.5",
      "-f",
      "null",
      "-",
    ]);

    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      // FFmpeg returns non-zero for null output, but that's expected
      const silences = parseSilenceDetection(stderr);
      resolve(silences);
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Build non-silent segments from detected silences
 */
function buildNonSilentSegments(
  duration: number,
  silences: Array<{ start: number; end: number }>,
): Array<{ start: number; end: number }> {
  if (silences.length === 0) {
    return [{ start: 0, end: duration }];
  }

  const segments: Array<{ start: number; end: number }> = [];
  let currentTime = 0;

  for (const silence of silences) {
    // Add segment before this silence
    if (silence.start > currentTime) {
      segments.push({ start: currentTime, end: silence.start });
    }
    currentTime = silence.end;
  }

  // Add final segment if there's time left
  if (currentTime < duration) {
    segments.push({ start: currentTime, end: duration });
  }

  return segments;
}

/**
 * Process video by removing silences
 */
async function processVideo(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  // Get video duration
  const duration = await getVideoDuration(inputPath);
  console.log(`Video duration: ${duration}s`);

  // Detect silences
  const silences = await detectSilences(inputPath);
  console.log(`Detected ${silences.length} silent segments`);

  // If no silences detected, just copy the file
  if (silences.length === 0) {
    console.log("No silences detected, copying original file");
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i",
        inputPath,
        "-c",
        "copy",
        outputPath,
      ]);

      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg copy failed with code ${code}`));
      });

      ffmpeg.on("error", reject);
    });
  }

  // Build non-silent segments
  const segments = buildNonSilentSegments(duration, silences);
  console.log(`Processing ${segments.length} non-silent segments`);

  // Create a concat file for FFmpeg
  const concatFilePath = join(TEMP_DIR, `concat-${Date.now()}.txt`);
  const segmentPaths: string[] = [];

  // Extract each segment
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    const segmentPath = join(TEMP_DIR, `segment-${Date.now()}-${i}.mp4`);
    segmentPaths.push(segmentPath);

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i",
        inputPath,
        "-ss",
        segment.start.toString(),
        "-t",
        (segment.end - segment.start).toString(),
        "-c",
        "copy",
        segmentPath,
      ]);

      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else
          reject(
            new Error(`FFmpeg segment extraction failed with code ${code}`),
          );
      });

      ffmpeg.on("error", reject);
    });
  }

  // Create concat file
  const concatContent = segmentPaths.map((p) => `file '${p}'`).join("\n");
  await import("fs/promises").then((fs) =>
    fs.writeFile(concatFilePath, concatContent),
  );

  // Concatenate segments
  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatFilePath,
      "-c",
      "copy",
      outputPath,
    ]);

    ffmpeg.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg concatenation failed with code ${code}`));
    });

    ffmpeg.on("error", reject);
  });

  // Cleanup segment files and concat file
  await Promise.all([
    ...segmentPaths.map((p) => unlink(p).catch(() => {})),
    unlink(concatFilePath).catch(() => {}),
  ]);
}

/**
 * Worker processor function
 */
async function processVideoJob(job: Job<VideoProcessingJobData>) {
  const { jobId, workspaceId, userId, inputFileKey, originalFilename } =
    job.data;

  console.log(`Processing video job ${jobId} (BullMQ ID: ${job.id})`);

  try {
    // Update status to processing
    await db
      .update(videoJobs)
      .set({ status: "processing" })
      .where(eq(videoJobs.id, jobId));

    // Download input file
    const inputPath = join(TEMP_DIR, `input-${jobId}.mp4`);
    console.log(`Downloading input file from R2: ${inputFileKey}`);
    await downloadFromR2(inputFileKey, inputPath);

    // Process video
    const outputPath = join(TEMP_DIR, `output-${jobId}.mp4`);
    console.log("Processing video with FFmpeg");
    await processVideo(inputPath, outputPath);

    // Upload output file
    const outputFileKey = `videos/output/${workspaceId}/${jobId}/${originalFilename}`;
    console.log(`Uploading output file to R2: ${outputFileKey}`);
    const outputBuffer = await import("fs/promises").then((fs) =>
      fs.readFile(outputPath),
    );
    await uploadFile(outputFileKey, outputBuffer);

    // Get video duration for the record (rounded to nearest second)
    const durationFloat = await getVideoDuration(outputPath).catch(() => null);
    const duration = durationFloat ? Math.round(durationFloat) : null;

    // Update job status to completed
    await db
      .update(videoJobs)
      .set({
        status: "completed",
        outputFileKey,
        duration,
        completedAt: new Date(),
      })
      .where(eq(videoJobs.id, jobId));

    // Get user and workspace info for email
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (user.length > 0 && user[0]!.email && workspace.length > 0) {
      // Generate download URL (this is a simplified approach - in production you'd generate a proper presigned URL)
      const downloadUrl = `${workerEnv.NEXT_PUBLIC_APP_URL}/dashboard/jobs/${jobId}`;

      await sendVideoCompletedEmail({
        to: user[0]!.email,
        userName: user[0]!.name ?? "User",
        videoFilename: originalFilename,
        downloadUrl,
        workspaceName: workspace[0]!.name,
        workspaceLogoUrl: workspace[0]!.logoUrl,
        workspacePrimaryColor: workspace[0]!.primaryColor!,
      });
    }

    // Cleanup temp files
    await Promise.all([
      unlink(inputPath).catch(() => {}),
      unlink(outputPath).catch(() => {}),
    ]);

    console.log(`Job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Update job status to failed
    await db
      .update(videoJobs)
      .set({
        status: "failed",
        error: errorMessage,
        completedAt: new Date(),
      })
      .where(eq(videoJobs.id, jobId));

    // Refund credit
    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (workspace.length > 0) {
      await db
        .update(workspaces)
        .set({ credits: workspace[0]!.credits + 1 })
        .where(eq(workspaces.id, workspaceId));
    }

    // Send failure email
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const workspaceData = workspace[0];

    if (user.length > 0 && user[0]!.email && workspaceData) {
      await sendVideoFailedEmail({
        to: user[0]!.email,
        userName: user[0]!.name ?? "User",
        videoFilename: originalFilename,
        errorMessage,
        workspaceName: workspaceData.name,
      });
    }

    throw error;
  }
}

// Create and start the worker
const worker = new Worker<VideoProcessingJobData>(
  "video-processing",
  processVideoJob,
  {
    connection,
    concurrency: 2, // Process 2 videos at a time
    limiter: {
      max: 10, // Max 10 jobs
      duration: 60000, // per minute
    },
  },
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

worker.on("error", (err) => {
  console.error("Worker error:", err);
});

console.log("Video processing worker started");
console.log(`Connected to Redis: ${workerEnv.REDIS_URL}`);
console.log(`Temp directory: ${TEMP_DIR}`);

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing worker...");
  await worker.close();
  await connection.quit();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, closing worker...");
  await worker.close();
  await connection.quit();
  process.exit(0);
});
