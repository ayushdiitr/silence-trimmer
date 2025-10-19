# Railway Worker - 5 Minute Setup

## The Question

> "How do I run the worker on Railway? Is it automated with my web service?"

**Answer**: No, the worker is a **separate service**. Here's how to set it up in 5 minutes:

## Quick Setup (3 Steps)

### Step 1: Create Worker Service (2 minutes)

1. Open your Railway project
2. Click **"+ New"** → **"GitHub Repo"**
3. Select the **same repository** as your web service
4. Railway creates a new service

### Step 2: Configure Start Command (1 minute)

1. Click on the new service → **Settings**
2. Find **"Start Command"**
3. Set it to: `npm run start:worker`
4. Click **Save**

### Step 3: Copy Environment Variables (2 minutes)

1. Go to your **Web service** → **Variables** tab
2. Click **"RAW Editor"** → Copy everything
3. Go to your **Worker service** → **Variables** tab  
4. Click **"RAW Editor"** → Paste everything
5. Click **Save**

**Done!** ✅

## Verify It Works

1. Go to Worker service → **Deployments**
2. Check the **Logs**
3. You should see:
   ```
   Video processing worker started
   Connected to Redis: redis://...
   ```

4. Upload a test video from your dashboard
5. Watch the worker logs for:
   ```
   Processing video job <id>...
   Job completed successfully
   ```

## Visual Guide

```
Your Railway Project
├── PostgreSQL       (Database)
├── Redis            (Queue)
├── Web Service      ← Already deployed
│   └── Runs: npm run start
└── Worker Service   ← NEW! Add this one
    └── Runs: npm run start:worker
```

## Key Points

✅ **Same repo, different commands**
- Web: `npm run start` (Next.js server)
- Worker: `npm run start:worker` (FFmpeg processor)

✅ **Same environment variables**
- Just copy all variables from web to worker
- They need the same `DATABASE_URL` and `REDIS_URL`

✅ **Independent services**
- Worker can restart without affecting web
- Can scale separately (add more workers for faster processing)

✅ **No code changes needed**
- Your code already supports this
- Just configure Railway properly

## Troubleshooting

### Worker not starting?

**Check the logs for the error:**

1. **"Invalid environment variables"**
   → Copy all env vars from web service

2. **"Cannot connect to Redis"**
   → Make sure Redis is added to your project
   → Check `REDIS_URL` is set

3. **"Cannot connect to database"**
   → Check `DATABASE_URL` is set
   → Make sure PostgreSQL is linked

### Videos stuck in "queued"?

1. **Check worker is running:**
   - Go to Worker service → Deployments
   - Should show "Active" status
   - Logs should show "Video processing worker started"

2. **Check Redis connection:**
   - Both services must use the SAME `REDIS_URL`
   - Railway usually links this automatically

3. **Restart the worker:**
   - Go to Worker service → Settings
   - Click "Restart"

## Cost

**How much does it cost to run a worker?**

- Railway charges based on usage
- Worker only uses resources when processing videos
- Estimate: $10-30/month for moderate usage
- Same as web service, but uses more CPU during processing

## Scaling

**Need faster processing?**

Add more workers:
1. Deploy another worker service (repeat steps above)
2. Or increase replicas in Worker settings (Pro plan)
3. Multiple workers process jobs in parallel

## Summary

| Question | Answer |
|----------|--------|
| Do I need a separate service? | ✅ Yes |
| Same repo? | ✅ Yes |
| Different start command? | ✅ Yes: `npm run start:worker` |
| Same environment variables? | ✅ Yes, copy all |
| Automatic deployment? | ✅ Yes, deploys when you push to GitHub |
| Extra cost? | ✅ ~$10-30/month |
| Can scale independently? | ✅ Yes |

## Next Steps

After worker is running:

1. ✅ Test video upload end-to-end
2. ✅ Check email notifications work
3. ✅ Monitor worker logs for any errors
4. ✅ Set up custom domain for web service
5. ✅ Configure Stripe webhook
6. ✅ Add Google OAuth callback

## Need More Help?

- 📖 Full guide: [RAILWAY_WORKER_SETUP.md](./RAILWAY_WORKER_SETUP.md)
- 🏗️ Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)
- 🚀 Deployment: [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)

---

**That's it!** Your worker is now processing videos on Railway 🎉

