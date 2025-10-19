# Worker Final Fix - Job Data Issue

## Problem Fixed

The worker was starting successfully but failing with:
```
Processing video job undefined
Job undefined failed: Error: UNDEFINED_VALUE: Undefined values are not allowed
```

## Root Cause

BullMQ passes a `Job` object to the processor function, not just the raw data. The processor function was incorrectly expecting just the data directly.

### Before (❌):
```typescript
async function processVideoJob(data: VideoProcessingJobData) {
  const { jobId, workspaceId, ... } = data;  // ❌ data is undefined!
```

### After (✅):
```typescript
async function processVideoJob(job: Job<VideoProcessingJobData>) {
  const { jobId, workspaceId, ... } = job.data;  // ✅ Correct!
```

## Changes Made

### 1. Updated Import in `src/worker/index.ts`

```typescript
import { Worker, type Job } from "bullmq";
```

### 2. Updated Processor Function Signature

```typescript
async function processVideoJob(job: Job<VideoProcessingJobData>) {
  const { jobId, workspaceId, userId, inputFileKey, originalFilename } = job.data;
  
  console.log(`Processing video job ${jobId} (BullMQ ID: ${job.id})`);
  // ... rest of the function
}
```

The key change: `job.data` instead of just `data`.

## How BullMQ Works

When BullMQ calls your processor function, it passes a `Job` object with this structure:

```typescript
{
  id: string;           // BullMQ's internal job ID
  name: string;         // Job name (e.g., "process-video")
  data: {               // Your custom data
    jobId: string;
    workspaceId: string;
    userId: string;
    inputFileKey: string;
    originalFilename: string;
  },
  progress: number;
  attemptsMade: number;
  // ... other BullMQ properties
}
```

You need to access `job.data` to get your custom job data.

## Testing

### 1. Make sure worker is running:
```bash
npm run dev:worker
```

You should see:
```
✅ Video processing worker started
✅ Connected to Redis: redis://localhost:6379
✅ Temp directory: /tmp/video-processor
```

### 2. Upload a video in the dashboard

### 3. Check worker logs:

You should now see:
```
Processing video job abc-123-def (BullMQ ID: 1)
Downloading input file from R2: videos/input/...
Processing video with FFmpeg
Video duration: 30s
Detected 5 silent segments
Processing 6 non-silent segments
Uploading output file to R2: videos/output/...
Job abc-123-def completed successfully
```

## All Fixes Summary

Here's everything we fixed to get the worker running:

### 1. Environment Variables (src/worker/env.ts)
```typescript
import dotenv from "dotenv";
dotenv.config();
import { env } from "~/env";
export const workerEnv = env;
```

### 2. Package.json Script
```json
"dev:worker": "tsx -r dotenv/config src/worker/index.ts"
```

### 3. Job Data Access (src/worker/index.ts)
```typescript
async function processVideoJob(job: Job<VideoProcessingJobData>) {
  const { jobId, ... } = job.data;  // Access job.data!
```

## Common Errors & Solutions

### Error: "Processing video job undefined"
**Cause**: Not accessing `job.data`
**Solution**: ✅ Fixed! Use `job.data` to access job properties

### Error: "Invalid environment variables"
**Cause**: `.env` not loaded
**Solution**: ✅ Fixed! Using dotenv in worker/env.ts

### Error: "connect ECONNREFUSED 127.0.0.1:6379"
**Cause**: Redis not running
**Solution**: Start Redis:
```bash
redis-server
# or
docker run -d -p 6379:6379 redis:alpine
```

### Error: "FFmpeg not found"
**Cause**: FFmpeg not installed
**Solution**: Install FFmpeg:
```bash
sudo apt-get install ffmpeg  # Ubuntu/Debian
brew install ffmpeg          # macOS
```

## Prerequisites Checklist

Before running the worker, ensure:
- ✅ `.env` file exists with all required variables
- ✅ Redis is running
- ✅ FFmpeg is installed
- ✅ PostgreSQL is running
- ✅ R2 credentials are correct

## Worker is Now Ready! 🎉

The worker should now:
1. ✅ Start without environment errors
2. ✅ Connect to Redis successfully
3. ✅ Process video jobs correctly
4. ✅ Access job data properly
5. ✅ Update database status
6. ✅ Send completion emails

Try uploading a video and watch the worker process it!

