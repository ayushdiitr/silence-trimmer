# Toast Notifications with Sonner

## Overview

Replaced all `alert()` calls with beautiful toast notifications using Sonner. Added real-time notifications when video processing completes or fails.

## Features Implemented

### 1. **Real-time Job Status Notifications** 🔔
- Automatically polls jobs every 5 seconds
- Shows toast when job status changes:
  - ✅ **Completed**: Success toast with download button
  - ❌ **Failed**: Error toast with failure reason
  - 🔄 **Processing**: Info toast when processing starts

### 2. **Upload Notifications** 📤
- File selection confirmation
- File size validation errors
- Upload progress tracking
- Upload success/failure

### 3. **Retry Notifications** 🔄
- Confirmation toast with action buttons
- Loading state during retry
- Success/error feedback

### 4. **Payment Notifications** 💳
- Loading state when redirecting to checkout
- Error handling for checkout failures

## Installation

### Step 1: Install Sonner

```bash
npm install sonner
```

The package has already been added to `package.json`:
```json
{
  "dependencies": {
    "sonner": "^1.7.1"
  }
}
```

### Step 2: Run npm install

```bash
npm install
```

## Changes Made

### 1. **Layout (`src/app/layout.tsx`)**

Added Toaster component at the root:

```tsx
import { Toaster } from "sonner";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <TRPCReactProvider>
          <Navigation />
          {children}
          <Toaster position="top-right" richColors />
        </TRPCReactProvider>
      </body>
    </html>
  );
}
```

**Configuration**:
- `position="top-right"` - Toasts appear in top-right corner
- `richColors` - Enables colored toasts (green for success, red for error, etc.)

### 2. **Dashboard (`src/app/dashboard/page.tsx`)**

#### Imports
```tsx
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
```

#### Real-time Job Monitoring
```tsx
// Poll jobs every 5 seconds
const { data: jobs } = api.video.getJobs.useQuery(
  { limit: 10 },
  { refetchInterval: 5000 }
);

// Track previous job statuses
const previousJobsRef = useRef<Map<string, string>>(new Map());

// Detect status changes and show notifications
useEffect(() => {
  jobs?.forEach((job) => {
    const previousStatus = previousJobsRef.current.get(job.id);
    
    if (previousStatus && previousStatus !== job.status) {
      if (job.status === "completed") {
        toast.success("Video processed successfully!", {
          description: `${job.originalFilename} is ready`,
          action: {
            label: "Download",
            onClick: () => window.location.href = `/dashboard/jobs/${job.id}`,
          },
        });
      }
      // ... other status checks
    }
    
    previousJobsRef.current.set(job.id, job.status);
  });
}, [jobs]);
```

#### Toast Replacements

**File Selection:**
```tsx
// Before: alert("File size must be less than 300MB")
// After:
toast.error("File too large", {
  description: "File size must be less than 300MB",
});

toast.success("File selected", {
  description: `${file.name} (${size} MB)`,
});
```

**Upload Success:**
```tsx
// Before: alert("Video uploaded successfully!")
// After:
toast.success("Video uploaded successfully!", {
  description: "Processing will begin shortly. You'll be notified when it's ready.",
  duration: 5000,
});
```

**Upload Error:**
```tsx
// Before: alert(error.message)
// After:
toast.error("Upload failed", {
  description: error.message,
});
```

**Retry Confirmation:**
```tsx
// Before: confirm("This will use 1 credit...")
// After:
toast.info("Confirm retry", {
  description: "This will use 1 credit. Click 'Retry' to continue.",
  action: {
    label: "Retry",
    onClick: async () => { /* retry logic */ },
  },
  cancel: {
    label: "Cancel",
    onClick: () => {},
  },
});
```

## Toast Types & Examples

### Success Toast
```tsx
toast.success("Operation successful!", {
  description: "Additional details here",
  duration: 5000,
});
```

### Error Toast
```tsx
toast.error("Operation failed", {
  description: "Error details here",
  duration: 10000,
});
```

### Info Toast
```tsx
toast.info("Information", {
  description: "Some info message",
});
```

### Loading Toast
```tsx
const toastId = toast.loading("Processing...");

// Later, update it:
toast.success("Done!", { id: toastId });
```

### Toast with Action Button
```tsx
toast.success("File ready!", {
  description: "Your video is ready to download",
  action: {
    label: "Download",
    onClick: () => handleDownload(),
  },
  duration: 10000,
});
```

### Toast with Cancel Button
```tsx
toast.info("Confirm action", {
  description: "Are you sure?",
  action: {
    label: "Confirm",
    onClick: () => handleConfirm(),
  },
  cancel: {
    label: "Cancel",
    onClick: () => {},
  },
});
```

## Notification Flow

### Upload Flow
```
1. User selects file
   → ✅ Toast: "File selected (video.mp4, 50 MB)"

2. User clicks upload
   → 📤 Upload progress bar shown

3. Upload completes
   → ✅ Toast: "Video uploaded successfully!"
   → 📊 Credits updated
   → 🔄 Job added to queue

4. Worker picks up job
   → ℹ️ Toast: "Processing started (video.mp4)"

5. Processing completes
   → ✅ Toast: "Video processed successfully!" [Download button]
   → 📧 Email notification sent
```

### Failure Flow
```
1. Processing fails
   → ❌ Toast: "Video processing failed"
   → 📝 Error: "FFmpeg not found"

2. User clicks retry
   → ℹ️ Toast: "Confirm retry" [Retry/Cancel buttons]

3. User confirms
   → ⏳ Toast: "Re-queueing job..."
   → ✅ Toast: "Job re-queued!"
```

## Configuration Options

### Toaster Props
```tsx
<Toaster
  position="top-right"       // Position on screen
  richColors                 // Colored backgrounds
  expand={false}             // Don't expand on hover
  visibleToasts={3}          // Max visible at once
  closeButton                // Show close button
  duration={4000}            // Default duration
/>
```

### Toast Options
```tsx
toast("Message", {
  description: "Details",    // Secondary text
  duration: 5000,            // How long to show (ms)
  action: {                  // Action button
    label: "Click me",
    onClick: () => {},
  },
  cancel: {                  // Cancel button
    label: "Cancel",
    onClick: () => {},
  },
  id: "unique-id",           // For updating later
  important: true,           // Pin to top
  onDismiss: () => {},       // Callback on dismiss
  onAutoClose: () => {},     // Callback on auto-close
});
```

## Benefits Over Alerts

### Before (Alerts) ❌
- Blocks the entire UI
- No styling options
- No rich content
- No actions/buttons
- Looks unprofessional
- Browser-dependent appearance

### After (Sonner) ✅
- Non-blocking
- Beautiful design
- Supports rich content (descriptions, actions)
- Customizable appearance
- Stacks multiple notifications
- Dismissible
- Action buttons
- Auto-dismiss with timer
- Professional look
- Consistent across browsers

## Real-time Notifications

### How It Works

1. **Polling**: Jobs are refetched every 5 seconds
2. **Tracking**: Previous job statuses stored in ref
3. **Comparison**: New status compared with previous
4. **Notification**: Toast shown only on status change

### Why This Approach?

- ✅ Simple to implement
- ✅ No WebSocket setup needed
- ✅ Works with existing tRPC setup
- ✅ Reliable (no connection drops)
- ⚠️ 5-second delay (acceptable for this use case)

### Alternative: WebSockets (Future Enhancement)

For instant notifications:
```tsx
// Could add WebSocket connection
const ws = new WebSocket('ws://...');
ws.onmessage = (event) => {
  const { jobId, status } = JSON.parse(event.data);
  if (status === 'completed') {
    toast.success("Video ready!");
  }
};
```

## Testing

### Test 1: Upload Notification
1. Select a video file
2. ✅ Should see: "File selected" toast
3. Click upload
4. ✅ Should see: "Video uploaded successfully!" toast

### Test 2: Processing Notifications
1. Upload a video
2. Wait ~5 seconds
3. ✅ Should see: "Processing started" toast
4. Wait for completion
5. ✅ Should see: "Video processed successfully!" toast with Download button

### Test 3: Error Notifications
1. Stop the worker
2. Upload a video
3. Wait for it to fail
4. ✅ Should see: "Video processing failed" toast with error message

### Test 4: Retry Notification
1. Find a failed job
2. Click "Retry"
3. ✅ Should see: "Confirm retry" toast with Retry/Cancel buttons
4. Click "Retry"
5. ✅ Should see: "Job re-queued!" toast

### Test 5: File Size Error
1. Try to select a file >300MB
2. ✅ Should see: "File too large" toast

## Customization

### Change Toast Position
```tsx
<Toaster position="bottom-right" />
// Options: top-left, top-center, top-right,
//          bottom-left, bottom-center, bottom-right
```

### Change Default Duration
```tsx
<Toaster duration={5000} />
```

### Custom Theme
```tsx
<Toaster
  theme="dark"              // or "light"
  richColors
  toastOptions={{
    style: {
      background: '#333',
      color: '#fff',
    },
  }}
/>
```

## Troubleshooting

### Toast not showing?
- Check `<Toaster />` is in layout
- Verify Sonner is installed: `npm list sonner`
- Check browser console for errors

### Too many toasts?
- Adjust `refetchInterval` (currently 5000ms)
- Increase `duration` so they auto-dismiss faster
- Set `visibleToasts` limit on Toaster

### Toast styling issues?
- Make sure Sonner CSS is loaded
- Check for conflicting CSS
- Verify `richColors` prop is set

## Summary

✅ **Installed**: Sonner toast library
✅ **Added**: Toaster component to layout
✅ **Replaced**: All `alert()` calls with toasts
✅ **Implemented**: Real-time job status notifications
✅ **Enhanced**: Retry flow with confirmation toast
✅ **Improved**: Upload feedback with detailed toasts

Users now get beautiful, non-blocking notifications for all actions! 🎉

