# Railway Worker Setup - Quick Guide

## TL;DR

You need **2 separate services** on Railway from the same repo:
1. **Web Service** - Runs `npm run start` (Next.js)
2. **Worker Service** - Runs `npm run start:worker` (FFmpeg processing)

## Why Two Services?

The worker is **NOT** part of your Next.js app. It's a separate background process that:

- ✅ Runs independently from your web server
- ✅ Can scale separately (more workers = faster video processing)
- ✅ Can restart without affecting your website
- ✅ Processes videos using FFmpeg (CPU-intensive)
- ✅ Listens to Redis queue for jobs

**Architecture:**
```
User uploads video → Web app adds job to Redis queue
                  ↓
            Worker picks up job from queue
                  ↓
            Worker processes video with FFmpeg
                  ↓
            Worker saves result to R2
                  ↓
            Worker updates database & sends email
```

## Step-by-Step Setup

### 1. Deploy Web Service (If Not Already Done)

1. Go to [Railway](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your repo
4. Railway creates a **Web Service** automatically
5. Add environment variables (see main RAILWAY_DEPLOYMENT.md)
6. Deploy

### 2. Add PostgreSQL & Redis

1. Click "+ New" → "Database" → "PostgreSQL"
2. Click "+ New" → "Database" → "Redis"
3. Railway automatically connects them to all services

### 3. Deploy Worker Service

This is the important part! 🚀

#### A. Create the Service

1. In your Railway project, click **"+ New"**
2. Select **"GitHub Repo"**
3. Choose the **SAME repository** as your web service
4. Railway creates a second service (initially it might try to run as a web app)

#### B. Configure the Service

Click on the new service, then go to **Settings**:

1. **Service Name**
   - Change to: `worker` (or `video-worker`)
   
2. **Root Directory**
   - Leave as: `/` (root of repo)
   
3. **Build Command**
   - Set to: `npm install`
   
4. **Start Command** ⚠️ **CRITICAL**
   - Set to: `npm run start:worker`
   - This is what makes it run as a worker instead of a web server!
   
5. **Custom Build Command** (Optional)
   - If you have a `railway.worker.json` in your repo:
     - In Settings → "Service" → "Config File Path"
     - Set to: `railway.worker.json`

#### C. Copy Environment Variables

The worker needs **ALL the same environment variables** as your web service.

**Quick Method:**
1. Go to your **Web service** → **Variables** tab
2. Click on the "RAW Editor" button
3. Copy everything
4. Go to your **Worker service** → **Variables** tab
5. Click "RAW Editor"
6. Paste everything

**Critical Variables:**
- ✅ `DATABASE_URL` (should be auto-linked from PostgreSQL)
- ✅ `REDIS_URL` (should be auto-linked from Redis)
- ✅ `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
- ✅ `RESEND_API_KEY`, `EMAIL_FROM`
- ✅ `NEXT_PUBLIC_APP_URL`
- ✅ All other environment variables from web service

⚠️ **Important**: Both services MUST use the same `DATABASE_URL` and `REDIS_URL`. Railway links these automatically.

#### D. Deploy

1. The worker service will automatically deploy
2. Go to the **Deployments** tab
3. Check the **Logs**

**Success looks like:**
```
Video processing worker started
Connected to Redis: redis://...
Temp directory: /tmp/video-processor
```

**Failure looks like:**
```
❌ Invalid environment variables
```
→ Fix: Add missing environment variables

### 4. Verify It Works

1. **Upload a test video** from your web app dashboard
2. **Check the worker logs** in Railway:
   ```
   Processing video job <job-id>
   Downloading video from R2...
   Running FFmpeg...
   Uploading processed video...
   Job completed successfully
   ```
3. **Check your email** for completion notification
4. **Check the database**: Job status should be "completed"

## Troubleshooting

### Worker starts but jobs aren't processing

**Problem**: Worker logs show "started" but no "Processing video job" messages

**Solutions:**
1. Check `REDIS_URL` is the same in both services
2. Verify web service is adding jobs to queue (check web logs)
3. Test Redis connection:
   ```bash
   # In Railway CLI
   railway run redis-cli -u $REDIS_URL ping
   ```

### Worker crashes immediately

**Problem**: Worker starts then exits with error code 1

**Solutions:**
1. Check worker logs for the error
2. Common issues:
   - Missing `DATABASE_URL` → Check PostgreSQL is linked
   - Missing `REDIS_URL` → Check Redis is linked
   - Invalid environment variables → Check all vars are set
   - FFmpeg not found → Should be automatic, but verify logs

### Videos stuck in "queued" status

**Problem**: Jobs are created but never start processing

**Solutions:**
1. **Check worker is running**: Look at worker deployments, should be "Active"
2. **Check worker logs**: Should see "Video processing worker started"
3. **Verify Redis connection**: Both services must use the same Redis instance
4. **Check credits**: User needs credits to process videos
5. **Restart worker**: Sometimes helps after config changes

### FFmpeg not found

**Problem**: Worker logs show "ffmpeg: command not found"

**Solution**: Add `nixpacks.toml` to your repo:
```toml
[phases.setup]
nixPkgs = ['nodejs-20_x', 'ffmpeg-full']

[phases.install]
cmds = ['npm ci']
```

Then redeploy the worker service.

### Out of memory errors

**Problem**: Worker crashes with "JavaScript heap out of memory"

**Solutions:**
1. Upgrade Railway plan (more memory)
2. Reduce worker concurrency in `src/worker/index.ts`:
   ```typescript
   const worker = new Worker('video-processing', processVideoJob, {
     connection,
     concurrency: 1, // Reduce from 2 to 1
   });
   ```
3. Process smaller videos
4. Add memory limit (Railway settings)

## Monitoring

### View Worker Logs

1. Go to Railway project
2. Click on **Worker service**
3. Click **Deployments** → Latest deployment
4. View **Logs** tab

You should see:
- `Video processing worker started` - Worker is running
- `Processing video job <id>` - Job started
- `Job <id> completed` - Job finished
- `Job <id> failed: <error>` - Job failed (check error)

### Check Queue Status

Use Railway CLI:
```bash
# Install CLI
npm i -g @railway/cli

# Login and link
railway login
railway link

# Connect to Redis
railway run redis-cli -u $REDIS_URL

# Check queue
> LLEN bull:video-processing:wait
> KEYS bull:video-processing:*
```

### Check Database

```sql
-- Count jobs by status
SELECT status, COUNT(*) 
FROM assignment_video_job 
GROUP BY status;

-- Recent failed jobs
SELECT id, "originalFilename", error, "createdAt"
FROM assignment_video_job 
WHERE status = 'failed'
ORDER BY "createdAt" DESC
LIMIT 10;
```

## Scaling

### Add More Workers

Process videos faster by running multiple workers:

1. Go to Worker service → Settings
2. Increase **Replicas** (Pro plan feature)
3. Or manually create more worker services from the same repo

Multiple workers:
- ✅ Process jobs in parallel
- ✅ Don't interfere with each other
- ✅ Pull from the same Redis queue
- ✅ Update the same database

### Increase Concurrency

Edit `src/worker/index.ts`:
```typescript
const worker = new Worker('video-processing', processVideoJob, {
  connection,
  concurrency: 4, // Process 4 jobs simultaneously per worker
});
```

**Guidelines:**
- 1-2 jobs per CPU core
- More concurrency = more memory usage
- Start with 1-2, increase if needed

## Cost Optimization

### Railway Pricing

Each service costs based on usage:
- **Web Service**: ~$5-15/month (low CPU, some requests)
- **Worker Service**: ~$10-30/month (high CPU when processing)
- **PostgreSQL**: ~$5-10/month
- **Redis**: ~$5-10/month

**Total**: ~$25-65/month for moderate usage

### Reduce Costs

1. **Scale down when not needed**: 
   - Reduce worker replicas during off-hours
   - Use Railway's auto-sleep for hobby plan

2. **Optimize FFmpeg**:
   - Lower output quality for faster processing
   - Skip unnecessary passes

3. **Use spot instances** (if available on Railway)

## Quick Reference

### Commands

```bash
# Local development
npm run dev          # Start web app
npm run dev:worker   # Start worker

# Production (Railway)
npm run start        # Web service
npm run start:worker # Worker service

# Database
npm run db:push      # Push schema changes
npm run db:studio    # Open Drizzle Studio
```

### Service Configuration

**Web Service:**
- Start command: `npm run start`
- Port: Auto-detected by Railway
- Needs: PostgreSQL, Redis, env vars

**Worker Service:**
- Start command: `npm run start:worker`
- Port: Not needed (no HTTP server)
- Needs: PostgreSQL, Redis, FFmpeg, env vars

### Environment Variables

Both services need:
```env
DATABASE_URL          # Auto from Railway PostgreSQL
REDIS_URL            # Auto from Railway Redis
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL
RESEND_API_KEY
EMAIL_FROM
NEXT_PUBLIC_APP_URL
NEXTAUTH_SECRET      # Web only, but doesn't hurt worker
NEXTAUTH_URL         # Web only, but doesn't hurt worker
GOOGLE_CLIENT_ID     # Web only, but doesn't hurt worker
GOOGLE_CLIENT_SECRET # Web only, but doesn't hurt worker
STRIPE_SECRET_KEY    # Web only, but doesn't hurt worker
STRIPE_WEBHOOK_SECRET # Web only, but doesn't hurt worker
STRIPE_PRICE_ID      # Web only, but doesn't hurt worker
```

**Tip**: Just copy ALL variables to both services. Extra variables won't hurt.

## Summary

✅ **Two services from one repo**: Web + Worker
✅ **Same environment variables**: Copy all vars to both
✅ **Different start commands**: `start` vs `start:worker`
✅ **Shared database & Redis**: Both connect to same instances
✅ **Independent scaling**: Scale web and worker separately
✅ **Monitor via logs**: Railway dashboard shows all activity

Your worker is now running on Railway! 🎉

## Need Help?

- Check worker logs for errors
- Verify environment variables match
- Ensure Redis URL is the same in both services
- Test locally first: `npm run dev:worker`
- Ask in Railway Discord or check docs

