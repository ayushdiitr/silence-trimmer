# Deployment Summary

## Quick Answer: Worker Deployment

**Q: How do I run the worker on Railway? Is it automated with my web service?**

**A: No, it's a separate service. Here's the 30-second explanation:**

1. Your Railway project needs **2 services** from the **same GitHub repo**
2. **Web Service**: Runs `npm run start` (Next.js)
3. **Worker Service**: Runs `npm run start:worker` (FFmpeg)
4. Both share the same database, Redis, and environment variables
5. They deploy independently but work together

## Files Created

This setup includes several configuration files for Railway deployment:

### Core Config Files

1. **`package.json`** (scripts)
   ```json
   {
     "scripts": {
       "dev:worker": "tsx -r dotenv/config src/worker/index.ts",
       "start:worker": "NODE_ENV=production tsx -r dotenv/config src/worker/index.ts"
     }
   }
   ```

2. **`railway.worker.json`** (worker config)
   - Optional configuration for worker service
   - Sets restart policy and start command

3. **`Procfile.worker`** (alternative)
   - Alternative to railway.json
   - Simple one-line config: `worker: npm run start:worker`

4. **`tsconfig.worker.json`** (TypeScript config)
   - Uses `Bundler` module resolution
   - Compatible with tsx runtime
   - No build step needed

## Documentation Files

Comprehensive guides for deployment:

| File | Purpose | When to Use |
|------|---------|-------------|
| **RAILWAY_WORKER_QUICK_START.md** | ⭐ 5-minute setup | Start here! Quick Railway worker setup |
| **RAILWAY_WORKER_SETUP.md** | Complete Railway guide | Detailed instructions, troubleshooting |
| **RAILWAY_DEPLOYMENT.md** | Full deployment guide | Complete Railway setup (web + worker) |
| **WORKER_DEPLOYMENT.md** | Alternative deployment | Docker, PM2, Systemd options |
| **ARCHITECTURE.md** | System architecture | Understanding how it all works |
| **WORKER_TYPESCRIPT_FIX.md** | TypeScript config fix | If you have TS compilation errors |
| **.github/RAILWAY_SETUP_DIAGRAM.txt** | Visual diagram | ASCII art of the architecture |

## Railway Setup Checklist

### 1. Initial Setup
- [ ] Railway account created
- [ ] GitHub repo connected
- [ ] Web service deployed
- [ ] PostgreSQL added
- [ ] Redis added

### 2. Worker Service Setup
- [ ] New service created from same repo
- [ ] Start command set to `npm run start:worker`
- [ ] Environment variables copied from web service
- [ ] Service renamed to "worker"
- [ ] First deployment successful

### 3. Verification
- [ ] Web service logs show "Server started"
- [ ] Worker logs show "Video processing worker started"
- [ ] Test video upload completes
- [ ] Email notification received
- [ ] Processed video downloadable

### 4. External Services
- [ ] Google OAuth configured with Railway URL
- [ ] Stripe webhook configured
- [ ] R2 bucket CORS configured
- [ ] Resend domain verified

### 5. Production Readiness
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active
- [ ] All environment variables set
- [ ] Database backups enabled
- [ ] Monitoring set up

## Architecture Summary

```
┌────────────────────────────────────────────────┐
│              Railway Project                   │
│                                                │
│  ┌──────────┐         ┌──────────┐           │
│  │   Web    │         │  Worker  │           │
│  │ Service  │         │ Service  │           │
│  └────┬─────┘         └────┬─────┘           │
│       │                    │                  │
│       ├─────┬──────────────┤                  │
│       │     │              │                  │
│  ┌────▼─┐ ┌─▼────┐         │                  │
│  │ DB   │ │Redis │         │                  │
│  └──────┘ └──────┘         │                  │
│                             │                  │
└─────────────────────────────┼──────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Cloudflare R2   │
                    │  (Video Storage)  │
                    └───────────────────┘
```

**Key Points:**
- ✅ Both services connect to same database
- ✅ Both services connect to same Redis
- ✅ Web adds jobs to Redis queue
- ✅ Worker picks up jobs from Redis queue
- ✅ Both services access R2 for videos
- ✅ Services can scale independently

## Common Issues & Solutions

### Issue: Worker not processing jobs

**Symptoms:**
- Videos stuck in "queued" status
- Worker logs show "started" but no processing

**Solutions:**
1. Verify `REDIS_URL` is identical in both services
2. Check worker is actually running (not crashed)
3. Restart worker service
4. Check user has credits

### Issue: TypeScript compilation errors

**Symptoms:**
- Worker won't start
- Error: "This expression is not constructable"
- Import errors

**Solution:**
- Use `tsconfig.worker.json` with `Bundler` module resolution
- No build step needed, uses tsx runtime
- See [WORKER_TYPESCRIPT_FIX.md](./WORKER_TYPESCRIPT_FIX.md)

### Issue: Environment variables not loading

**Symptoms:**
- "Invalid environment variables" error
- "DATABASE_URL required" error

**Solution:**
- Copy ALL environment variables from web to worker
- Verify PostgreSQL and Redis are linked
- Check Railway dashboard for auto-provided variables

### Issue: FFmpeg not found

**Symptoms:**
- "ffmpeg: command not found" in worker logs
- Jobs fail immediately

**Solution:**
- Railway's Nixpacks includes FFmpeg by default
- If missing, add `nixpacks.toml`:
  ```toml
  [phases.setup]
  nixPkgs = ['nodejs-20_x', 'ffmpeg-full']
  ```

## Environment Variables Reference

### Shared (Both Services)

```env
# Auto-provided by Railway
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# R2 Storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# Email
RESEND_API_KEY=
EMAIL_FROM=

# App URL
NEXT_PUBLIC_APP_URL=
```

### Web Service Only (but safe to copy to worker)

```env
# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=
```

**Pro Tip:** Just copy ALL variables to both services. Extra variables won't hurt the worker.

## Scaling Guide

### When to Scale Web Service

Scale up when:
- ❌ Response times > 500ms
- ❌ CPU usage > 80%
- ❌ Memory usage > 80%
- ❌ Many concurrent users

**How:**
- Increase replicas in Railway settings
- Railway auto-balances traffic

### When to Scale Worker Service

Scale up when:
- ❌ Videos stuck in queue for > 5 minutes
- ❌ Queue length > 10 jobs
- ❌ Processing takes too long
- ❌ Peak usage times

**How:**
- Add more worker services (duplicate the worker)
- Or increase replicas (Pro plan)
- Workers automatically share queue

### Concurrency Tuning

Edit `src/worker/index.ts`:
```typescript
const worker = new Worker('video-processing', processVideoJob, {
  connection,
  concurrency: 2, // Adjust based on CPU/memory
});
```

**Guidelines:**
- Start with 1-2 concurrent jobs
- Monitor memory usage
- Increase if resources allow
- More concurrency = faster but more memory

## Cost Estimate

### Hobby Plan (~$25-45/month)

- PostgreSQL: $5-10
- Redis: $5-10
- Web Service: $5-10 (low traffic)
- Worker Service: $10-15 (light processing)

### Production Plan (~$50-100/month)

- PostgreSQL: $10-20 (more data)
- Redis: $10-15 (more jobs)
- Web Service: $15-25 (moderate traffic)
- Worker Service: $20-40 (heavy processing)

**Variables:**
- More videos = higher worker cost
- More users = higher web cost
- Processing time affects worker cost
- Storage (R2) is separate (~$0.015/GB)

## Testing Your Deployment

### 1. Test Web Service

```bash
curl https://your-app.railway.app
# Should return landing page HTML

curl https://your-app.railway.app/api/auth/signin
# Should return sign-in page
```

### 2. Test Worker Service

Check logs for:
```
✅ Video processing worker started
✅ Connected to Redis: redis://...
✅ Temp directory: /tmp/video-processor
```

### 3. End-to-End Test

1. Sign in with Google
2. Buy credits (or use free credit)
3. Upload a test video (< 50MB)
4. Watch worker logs:
   ```
   Processing video job <id>
   Downloading video from R2
   Running FFmpeg
   Uploading processed video
   Job completed successfully
   ```
5. Check email for notification
6. Download processed video
7. Verify silence is removed

## Monitoring

### Railway Dashboard

**Web Service:**
- CPU and memory usage
- Request count
- Response times
- Logs

**Worker Service:**
- CPU and memory usage
- Active jobs count
- Logs with processing status

### Database Queries

```sql
-- Job statistics
SELECT 
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt"))) as avg_duration_seconds
FROM assignment_video_job
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Failed jobs
SELECT id, "originalFilename", error, "createdAt"
FROM assignment_video_job
WHERE status = 'failed'
ORDER BY "createdAt" DESC
LIMIT 10;

-- Queue depth (recent queued jobs)
SELECT COUNT(*) as queued_count
FROM assignment_video_job
WHERE status = 'queued';
```

### Redis Queue

```bash
# Via Railway CLI
railway run redis-cli -u $REDIS_URL

# Check queue length
LLEN bull:video-processing:wait

# List all queue keys
KEYS bull:video-processing:*

# Check active jobs
LLEN bull:video-processing:active
```

## Next Steps After Deployment

1. ✅ Set up custom domain
2. ✅ Configure monitoring/alerts
3. ✅ Set up database backups
4. ✅ Test payment flow thoroughly
5. ✅ Test white-label feature with custom domain
6. ✅ Load test with multiple videos
7. ✅ Document internal processes
8. ✅ Set up error tracking (Sentry, etc.)

## Support Resources

### Documentation
- [Railway Docs](https://docs.railway.app)
- [Next.js Docs](https://nextjs.org/docs)
- [Drizzle ORM Docs](https://orm.drizzle.team)
- [BullMQ Docs](https://docs.bullmq.io)

### Community
- [Railway Discord](https://discord.gg/railway)
- [Next.js Discord](https://nextjs.org/discord)

### Project Docs
- Start with **RAILWAY_WORKER_QUICK_START.md**
- Detailed setup in **RAILWAY_WORKER_SETUP.md**
- Architecture overview in **ARCHITECTURE.md**
- Troubleshooting in **WORKER_DEPLOYMENT.md**

## Summary

✅ **Two services needed**: Web + Worker
✅ **Same repository**: Different start commands
✅ **Shared resources**: Database, Redis, R2
✅ **Independent scaling**: Scale each service separately
✅ **No build step**: Uses tsx runtime directly
✅ **Production ready**: With monitoring and backups

Your video processing platform is ready to deploy! 🚀

---

**Quick Commands:**

```bash
# Local development
npm run dev          # Start web
npm run dev:worker   # Start worker

# Railway production
# Web: npm run start
# Worker: npm run start:worker
```

**Need help?** Check RAILWAY_WORKER_QUICK_START.md first!

