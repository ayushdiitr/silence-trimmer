# Video Job Retry Feature

## Overview

Added a retry feature that allows users to re-queue failed video processing jobs. This helps users recover from temporary failures without having to re-upload videos.

## Features

### 1. Retry Button for Failed Jobs

- **Displays** on all jobs with `status: "failed"`
- **Location**: Dashboard job list, next to the status badge
- **Color**: Orange (to distinguish from completed/download button)
- **Cost**: Uses 1 credit per retry

### 2. Error Message Display

- Shows the error message for failed jobs
- Helps users understand why a job failed
- Displayed in red text below the job timestamp

### 3. Credit Check

- Validates user has sufficient credits before retrying
- Shows error message if insufficient credits
- Automatically deducts 1 credit on retry

## Implementation

### Backend (`src/server/api/routers/video.ts`)

Added `retryJob` mutation:

```typescript
retryJob: workspaceProcedure
  .input(z.object({
    jobId: z.string().uuid(),
    workspaceId: z.string().optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    // 1. Get the failed job
    // 2. Validate job exists and belongs to workspace
    // 3. Validate job status is "failed"
    // 4. Check workspace has credits
    // 5. Reset job status to "queued"
    // 6. Clear error and output fields
    // 7. Re-add job to BullMQ queue
    // 8. Deduct 1 credit from workspace
  })
```

### Frontend (`src/app/dashboard/page.tsx`)

1. **Added mutation hook**:
   ```typescript
   const retryJob = api.video.retryJob.useMutation();
   ```

2. **Added retry handler**:
   ```typescript
   const handleRetry = async (jobId: string) => {
     if (!confirm("This will use 1 credit...")) return;
     await retryJob.mutateAsync({ jobId });
     await refetchCredits();
     await refetchJobs();
   }
   ```

3. **Added retry button in UI**:
   ```tsx
   {job.status === "failed" && (
     <button onClick={() => handleRetry(job.id)}>
       Retry
     </button>
   )}
   ```

4. **Added error message display**:
   ```tsx
   {job.status === "failed" && job.error && (
     <p className="text-red-600">Error: {job.error}</p>
   )}
   ```

## User Flow

### 1. Job Fails

```
User uploads video → Processing fails → Status: "failed"
```

Dashboard shows:
- ❌ Red "failed" badge
- 🔴 Error message (e.g., "FFmpeg not found")
- 🔄 Orange "Retry" button

### 2. User Clicks Retry

```
User clicks "Retry" → Confirmation dialog → Retry mutation
```

Confirmation:
```
⚠️ This will use 1 credit. Are you sure you want to retry this job?
[Cancel] [OK]
```

### 3. Job Re-queued

```
Status: "failed" → "queued" → Worker processes → "processing" → "completed"
```

After retry:
- Job status changes to "queued"
- Error message cleared
- Credits decremented by 1
- Job re-added to queue
- Worker picks up and processes

### 4. Success

```
Job completes → Status: "completed" → Download button appears
```

## Validation & Edge Cases

### ✅ Validations

1. **Job exists**: Returns 404 if job not found
2. **Job ownership**: Only workspace owner/members can retry
3. **Job status**: Only "failed" jobs can be retried
4. **Credits**: Must have at least 1 credit
5. **Input file**: Original file must still exist in R2

### ⚠️ Edge Cases Handled

1. **Insufficient credits**:
   ```
   Error: "Insufficient credits. Please purchase more credits to retry."
   ```

2. **Job not failed**:
   ```
   Error: "Only failed jobs can be retried"
   ```

3. **Job not found**:
   ```
   Error: "Job not found"
   ```

4. **Network error**:
   ```
   Shows error alert with message
   ```

### 🔄 What Gets Reset on Retry

When a job is retried:
- ✅ `status` → "queued"
- ✅ `error` → null
- ✅ `completedAt` → null
- ✅ `outputFileKey` → null
- ❌ `inputFileKey` → **preserved** (original upload)
- ❌ `originalFilename` → **preserved**
- ❌ `createdAt` → **preserved**

## UI Design

### Job Card Layout

```
┌─────────────────────────────────────────────────────────┐
│ video.mp4                                               │
│ 10/19/2025, 2:30 PM                                    │
│ Error: FFmpeg not found                        ❌ failed│
│                                                🔄 Retry  │
└─────────────────────────────────────────────────────────┘
```

### Button States

**Normal State**:
```jsx
<button className="bg-orange-600 hover:bg-orange-700">
  Retry
</button>
```

**Loading State**:
```jsx
<button className="bg-orange-600 opacity-50 cursor-not-allowed" disabled>
  Retrying...
</button>
```

### Color Scheme

- **Retry button**: Orange (`bg-orange-600`)
- **Error text**: Red (`text-red-600`)
- **Failed badge**: Red (`bg-red-100 text-red-800`)

## Testing

### Test Case 1: Successful Retry

1. Upload a video
2. Stop worker or cause it to fail
3. Wait for job to fail
4. Click "Retry" button
5. Confirm in dialog
6. ✅ Job should be re-queued
7. ✅ Credits should decrease by 1
8. ✅ Status should change to "queued"

### Test Case 2: Insufficient Credits

1. Set workspace credits to 0
2. Try to retry a failed job
3. ✅ Should show error: "Insufficient credits..."

### Test Case 3: Non-failed Job

1. Try to retry a "completed" or "queued" job (via API)
2. ✅ Should show error: "Only failed jobs can be retried"

### Test Case 4: Multiple Retries

1. Retry a failed job
2. If it fails again, retry button appears again
3. ✅ Can retry multiple times (each uses 1 credit)

## Common Failure Scenarios & Solutions

### FFmpeg Not Found

**Error**: `FFmpeg not found`
**Solution**: Install FFmpeg on the worker server
```bash
sudo apt-get install ffmpeg
```

### R2 Connection Error

**Error**: `Failed to download from R2`
**Solution**: 
- Check R2 credentials
- Verify file still exists in R2
- Check R2 bucket permissions

### Out of Memory

**Error**: `JavaScript heap out of memory`
**Solution**: 
- Increase Node.js memory limit
- Process smaller videos
- Optimize video processing settings

### Redis Connection Error

**Error**: `connect ECONNREFUSED 127.0.0.1:6379`
**Solution**: Start Redis server
```bash
redis-server
```

## Future Enhancements

### Potential Improvements:

1. **Automatic Retries**: 
   - Auto-retry failed jobs 1-2 times before marking as failed
   - Exponential backoff between retries

2. **Batch Retry**:
   - Allow retrying multiple failed jobs at once
   - "Retry All Failed" button

3. **Retry History**:
   - Track number of retry attempts
   - Show retry count in UI

4. **Partial Credits**:
   - Don't charge full credit for retries
   - Or offer free retry for first failure

5. **Smart Retry**:
   - Analyze error and suggest fixes
   - Only show retry if error is recoverable

6. **Notification**:
   - Email when retry completes
   - Push notification for status changes

## API Reference

### Mutation: `video.retryJob`

**Input**:
```typescript
{
  jobId: string;        // UUID of the failed job
  workspaceId?: string; // Optional, inferred from context
}
```

**Output**:
```typescript
{
  success: boolean;
  jobId: string;
}
```

**Errors**:
- `NOT_FOUND` (404): Job not found
- `BAD_REQUEST` (400): Job is not failed
- `FORBIDDEN` (403): Insufficient credits
- `UNAUTHORIZED` (401): Not authenticated

## Summary

✅ **Added**: Retry button for failed jobs
✅ **Added**: Error message display
✅ **Added**: Credit validation
✅ **Added**: Confirmation dialog
✅ **Implemented**: Backend retry mutation
✅ **Implemented**: Frontend UI and handlers

Users can now easily retry failed video processing jobs with a single click! 🎉

