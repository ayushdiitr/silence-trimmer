import { Queue } from "bullmq";
import Redis from "ioredis";
import { env } from "~/env";

// Lazy initialization to avoid connecting during build
let connection: Redis | undefined;
let queue: Queue | undefined;

function getConnection(): Redis {
  if (!connection) {
    connection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

function getQueue(): Queue {
  if (!queue) {
    queue = new Queue("video-processing", {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000, // 5 seconds initial delay
        },
        removeOnComplete: {
          count: 100, // Keep last 100 completed jobs
          age: 24 * 3600, // Keep jobs for 24 hours
        },
        removeOnFail: {
          count: 500, // Keep last 500 failed jobs
        },
      },
    });
  }
  return queue;
}

// Export a proxy that lazily initializes the queue
export const videoProcessingQueue = new Proxy({} as Queue, {
  get: (_target, prop) => {
    const q = getQueue();
    const value = q[prop as keyof Queue];
    if (typeof value === "function") {
      return value.bind(q);
    }
    return value;
  },
});

export interface VideoProcessingJobData {
  jobId: string;
  workspaceId: string;
  userId: string;
  inputFileKey: string;
  originalFilename: string;
}

/**
 * Add a video processing job to the queue
 */
export async function addVideoProcessingJob(data: VideoProcessingJobData) {
  const job = await videoProcessingQueue.add("process-video", data, {
    jobId: data.jobId,
  });

  return job;
}

/**
 * Get the status of a job
 */
export async function getJobStatus(jobId: string) {
  const job = await videoProcessingQueue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: job.id,
    state,
    progress,
    failedReason: job.failedReason,
    finishedOn: job.finishedOn,
  };
}
