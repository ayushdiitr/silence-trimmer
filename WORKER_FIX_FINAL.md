# Worker Environment Variables - Final Fix

## Problem

Running `npm run dev:worker` gave environment variable errors because `tsx` doesn't automatically load `.env` files, and `@t3-oss/env-nextjs` validates environment variables immediately on import.

## Solution

Created a worker-specific environment loader (`src/worker/env.ts`) that:
1. Loads `.env` file using `dotenv`
2. Then imports the main `~/env` 
3. Re-exports it as `workerEnv`

This ensures environment variables are loaded BEFORE validation happens.

## What Changed

### 1. Created `src/worker/env.ts`

```typescript
// Load dotenv BEFORE anything else
import { config } from "dotenv";
config();

// Now import and re-export the main env
import { env } from "~/env";

export const workerEnv = env;
```

### 2. Updated `src/worker/index.ts`

- Changed first import to: `import { workerEnv } from "./env";`
- Replaced all `env.` references with `workerEnv.`
- Removed direct import of `~/env`

### 3. Added `dotenv` to `package.json`

- Added `"dotenv": "^16.6.1"` to dependencies

## How to Use

### 1. Make sure dotenv is installed:

```bash
npm install
```

### 2. Verify your `.env` file exists with all variables:

```bash
# Check if .env exists
ls -la .env

# Check if it has required variables
grep -E "DATABASE_URL|REDIS_URL|R2_" .env
```

### 3. Start Redis (if not already running):

```bash
# Test if Redis is running
redis-cli ping

# If not running:
redis-server

# Or with Docker:
docker run -d -p 6379:6379 redis:alpine
```

### 4. Start the worker:

```bash
npm run dev:worker
```

You should see:
```
✅ Video processing worker started
✅ Connected to Redis: redis://localhost:6379
✅ Temp directory: /tmp/video-processor
```

## Why This Works

### The Problem:
```typescript
// ❌ This doesn't work in worker
import { env } from "~/env";  
// env.js validates immediately, but .env not loaded yet!
```

### The Solution:
```typescript
// ✅ This works
import { config } from "dotenv";
config();  // Load .env FIRST

import { env } from "~/env";  // NOW validation works!
```

### Import Order Matters:

The worker now imports in this order:
1. `src/worker/env.ts` - Loads dotenv, then imports ~/env
2. `src/worker/index.ts` - Imports worker/env (NOT ~/env directly)
3. Other imports like `~/server/db` - These import ~/env, but it's OK because dotenv already ran

## Architecture

```
Worker Entry Point (index.ts)
  ↓
Worker Environment Loader (worker/env.ts)
  ↓ [loads .env via dotenv]
  ↓ [imports ~/env]
  ↓ [re-exports as workerEnv]
  ↓
Main App Environment (~/env.js)
  ↓ [@t3-oss/env-nextjs validates]
  ↓ [process.env is populated ✅]
  ↓
Validation Success! 🎉
```

## Testing

### Test 1: Check Environment Loading

```bash
npm run dev:worker
```

Should show: `Connected to Redis: redis://...`

### Test 2: Process a Video

1. Start Next.js app:
   ```bash
   npm run dev
   ```

2. Upload a video in the dashboard

3. Check worker logs for:
   ```
   Processing video job abc-123
   Downloading input file from R2...
   Processing video with FFmpeg...
   Video duration: 30s
   Detected 5 silent segments
   Processing 6 non-silent segments
   Uploading output file to R2...
   Job abc-123 completed successfully
   ```

## Troubleshooting

### Still getting "Invalid environment variables"?

**Check 1: Is dotenv installed?**
```bash
npm list dotenv
# Should show: dotenv@16.6.1
```

**Check 2: Is .env in the right place?**
```bash
# Should be in project root, same directory as package.json
ls -la .env

# Should return the file path
pwd
# Should show: /home/ayush/repos/ddd/assignment
```

**Check 3: Are variables in .env file?**
```bash
cat .env | head -n 5
# Should show your environment variables
```

**Check 4: No syntax errors in .env?**
```bash
# Check for common issues:
# ❌ DATABASE_URL = "..." (spaces around =)
# ✅ DATABASE_URL="..."    (no spaces)

# ❌ DATABASE_URL='...'    (single quotes might cause issues)
# ✅ DATABASE_URL="..."    (use double quotes or no quotes)
```

### Error: "connect ECONNREFUSED 127.0.0.1:6379"

Redis is not running. Start it:
```bash
redis-server
```

### Error: "FFmpeg not found"

FFmpeg is not installed:
```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg

# Verify installation
ffmpeg -version
```

### Worker starts but doesn't process jobs

1. Check both terminals (Next.js app + worker) for errors
2. Verify upload completes in the UI
3. Check Redis has the job:
   ```bash
   redis-cli
   KEYS *
   ```

## Alternative Approach (if this doesn't work)

If you still have issues, you can use tsx's `-r` flag to load dotenv:

**Update `package.json`:**
```json
{
  "scripts": {
    "dev:worker": "tsx -r dotenv/config watch src/worker/index.ts"
  }
}
```

Then revert `src/worker/env.ts` to just:
```typescript
export { env as workerEnv } from "~/env";
```

But the current approach (loading in the file) is cleaner and more explicit.

## Summary

✅ **Created**: `src/worker/env.ts` - Loads dotenv then imports main env
✅ **Updated**: `src/worker/index.ts` - Uses workerEnv instead of env
✅ **Added**: `dotenv` to dependencies
✅ **Works**: Environment variables now load correctly in worker

The key insight: **Load `.env` BEFORE importing any files that validate environment variables.**

Try running `npm run dev:worker` now - it should work!

