# Worker Environment Variables Fix

## Problem

When running `npm run dev:worker`, you got environment variable errors:

```
❌ Invalid environment variables: [
  {
    code: 'invalid_type',
    expected: 'string',
    received: 'undefined',
    path: [ 'DATABASE_URL' ],
    message: 'Required'
  },
  {
    code: 'invalid_type',
    expected: 'string',
    received: 'undefined',
    path: [ 'REDIS_URL' ],
    ...
```

## Root Cause

Unlike Next.js which automatically loads `.env` files, `tsx` (the TypeScript executor used for the worker) doesn't load environment variables automatically. The worker imports `~/env.js` which validates environment variables, but they're undefined because the `.env` file wasn't loaded.

## Solution

I've updated the code to use the `dotenv` package to load environment variables before importing anything else.

## Changes Made

### 1. Added `dotenv` to `package.json`

Added `"dotenv": "^16.4.5"` to dependencies.

### 2. Updated `src/worker/index.ts`

Added dotenv import and configuration at the very top of the file:

```typescript
// Load environment variables from .env file BEFORE anything else
import { config } from "dotenv";
config();

// Now other imports will work
import { env } from "~/env";
// ... rest of imports
```

## Steps to Fix

### 1. Install dotenv Package

```bash
npm install
```

This will install the `dotenv` package that was added to `package.json`.

### 2. Make Sure You Have a .env File

Ensure you have a `.env` file in the project root with all required variables:

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/assignment"

# Redis
REDIS_URL="redis://localhost:6379"

# NextAuth
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"

# Cloudflare R2
R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-access-key"
R2_SECRET_ACCESS_KEY="your-secret-key"
R2_BUCKET_NAME="your-bucket-name"
R2_PUBLIC_URL="https://your-public-url"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_ID="price_..."

# Resend (Email)
RESEND_API_KEY="re_..."
EMAIL_FROM="noreply@yourdomain.com"

# Public URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Start the Worker

```bash
npm run dev:worker
```

You should now see:

```
Video processing worker started
Connected to Redis: redis://localhost:6379
Temp directory: /tmp/video-processor
```

## How It Works

### Before (❌):
```typescript
import { env } from "~/env";  // ❌ env vars not loaded yet!
// env validation fails because process.env is empty
```

### After (✅):
```typescript
import { config } from "dotenv";
config();  // ✅ Loads .env file into process.env

import { env } from "~/env";  // ✅ Now validation works!
```

## Why This is Needed

Different tools handle environment variables differently:

| Tool | Auto-loads .env? | Notes |
|------|------------------|-------|
| Next.js | ✅ Yes | Automatically loads `.env` files |
| tsx | ❌ No | Needs `dotenv` package |
| node | ❌ No | Needs `dotenv` or `--env-file` flag |
| Vitest | ✅ Yes | Has built-in `.env` support |

## Alternative Solutions

### Option 1: Use tsx with --env-file (Node 20.6+)

If you have Node.js 20.6+, you can use the `--env-file` flag:

```json
{
  "scripts": {
    "dev:worker": "tsx --env-file=.env watch src/worker/index.ts"
  }
}
```

But using `dotenv` is more compatible across Node versions.

### Option 2: Use tsx with -r dotenv/config

Another approach (but requires dotenv installed):

```json
{
  "scripts": {
    "dev:worker": "tsx -r dotenv/config watch src/worker/index.ts"
  }
}
```

But the current solution (importing at the top of the file) is clearer and more explicit.

## Testing the Worker

### 1. Start Required Services

Make sure you have:
- ✅ PostgreSQL running (or use `./start-database.sh`)
- ✅ Redis running

Check if Redis is running:
```bash
redis-cli ping
# Should return: PONG
```

If Redis isn't running:
```bash
# Install Redis (if not installed)
sudo apt-get install redis-server

# Start Redis
redis-server
```

Or use Docker:
```bash
docker run -d -p 6379:6379 redis:alpine
```

### 2. Start the Worker

In one terminal:
```bash
npm run dev:worker
```

### 3. Start the Next.js App

In another terminal:
```bash
npm run dev
```

### 4. Test Upload

1. Go to http://localhost:3000/dashboard
2. Upload a video file
3. Check the worker terminal for processing logs

You should see logs like:
```
Processing video job abc-123-def
Downloading input file from R2: videos/input/...
Processing video with FFmpeg
Video duration: 30s
Detected 5 silent segments
Processing 6 non-silent segments
Uploading output file to R2: videos/output/...
Job abc-123-def completed successfully
```

## Troubleshooting

### Error: "connect ECONNREFUSED 127.0.0.1:6379"

**Problem**: Redis is not running
**Solution**: Start Redis:
```bash
redis-server
# or
docker run -d -p 6379:6379 redis:alpine
```

### Error: "FFmpeg not found"

**Problem**: FFmpeg is not installed
**Solution**: Install FFmpeg:
```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg
```

### Error: Still getting "Invalid environment variables"

**Problem**: .env file not in the correct location or has wrong format
**Solution**: 
1. Ensure `.env` is in the project root (same directory as `package.json`)
2. Check for syntax errors in `.env` (no spaces around `=`)
3. Make sure all required variables are present
4. Try running: `cat .env | grep DATABASE_URL` to verify the file exists

### Worker starts but doesn't process jobs

**Problem**: Next.js app not adding jobs to the queue
**Solution**:
1. Check Next.js app is running
2. Check Redis connection in both app and worker
3. Verify upload completes successfully in the UI
4. Check for errors in both Next.js and worker logs

## Production Deployment

For production, you won't use `tsx`. Instead:

### 1. Build the Worker

```bash
npm run build:worker
```

This compiles TypeScript to JavaScript in `dist/worker/`.

### 2. Run the Worker

```bash
npm run start:worker
```

Or use a process manager like PM2:

```bash
pm2 start dist/worker/index.js --name video-worker
```

### 3. Environment Variables in Production

On platforms like Railway, Heroku, or Vercel:
- Set environment variables in the platform dashboard
- Don't commit `.env` files to git
- Use `.env.example` as a template

The `dotenv` package will only load `.env` if environment variables aren't already set, so it works in both development and production.

## Summary

✅ Added `dotenv` package
✅ Updated worker to load `.env` file
✅ Worker now has access to all environment variables
✅ Same approach works in development and production

After running `npm install`, your worker should start without errors!

