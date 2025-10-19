# Worker Deployment Guide

## Overview

The worker is deployed using `tsx` which runs TypeScript directly without a build step. This simplifies deployment and avoids module resolution issues.

## Why No Build Step?

The worker uses:
- **Path aliases** (`~/server/...`) 
- **ESM imports** (`import` statements)
- **Mixed module types** (CommonJS and ESM packages)

Building with `tsc` would require:
1. Resolving all path aliases
2. Converting to CommonJS or pure ESM
3. Handling mixed module types
4. Complex bundler configuration

Instead, we use `tsx` which:
- ✅ Handles TypeScript directly
- ✅ Resolves path aliases automatically
- ✅ Works with mixed module types
- ✅ No build step needed
- ✅ Simpler deployment

## Scripts

### Development
```bash
npm run dev:worker
```

Runs the worker with:
- Hot reload on file changes
- dotenv for environment variables
- Full TypeScript support

### Production
```bash
npm run start:worker
```

Runs the worker with:
- `NODE_ENV=production`
- dotenv for environment variables
- Direct TypeScript execution via tsx

## Deployment Options

### Option 1: Direct Deployment (Recommended)

Deploy the entire source code and run with tsx:

```bash
# On your server
git clone <repo>
cd assignment
npm install
npm run start:worker
```

**Pros:**
- ✅ Simple
- ✅ No build step
- ✅ Easy to debug
- ✅ Hot reload in dev

**Cons:**
- ⚠️ Requires TypeScript in production
- ⚠️ Slightly slower startup (JIT compilation)

### Option 2: Docker Deployment

**Dockerfile:**
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Run worker
CMD ["npm", "run", "start:worker"]
```

**Build and run:**
```bash
docker build -t video-worker .
docker run -d \
  --env-file .env \
  --name worker \
  video-worker
```

### Option 3: Process Manager (PM2)

For production with auto-restart:

```bash
# Install PM2
npm install -g pm2

# Start worker
pm2 start npm --name "video-worker" -- run start:worker

# Save PM2 config
pm2 save

# Setup auto-start on reboot
pm2 startup
```

**PM2 Config** (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'video-worker',
    script: 'npm',
    args: 'run start:worker',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

Then:
```bash
pm2 start ecosystem.config.js
```

### Option 4: Systemd Service

**Create service file** (`/etc/systemd/system/video-worker.service`):
```ini
[Unit]
Description=Video Processing Worker
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/assignment
Environment="NODE_ENV=production"
EnvironmentFile=/var/www/assignment/.env
ExecStart=/usr/bin/npm run start:worker
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl enable video-worker
sudo systemctl start video-worker
sudo systemctl status video-worker
```

## Environment Variables

The worker needs these environment variables:

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis
REDIS_URL=redis://host:6379

# R2 Storage
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=your-bucket
R2_PUBLIC_URL=https://your-bucket.r2.dev

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com

# App URL (for email links)
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Dependencies

The worker requires these system dependencies:

### FFmpeg
```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg

# Verify
ffmpeg -version
```

### Node.js
```bash
# Minimum version: 18.x
node --version
```

## Monitoring

### Logs

**PM2:**
```bash
pm2 logs video-worker
```

**Systemd:**
```bash
sudo journalctl -u video-worker -f
```

**Docker:**
```bash
docker logs -f worker
```

### Health Check

The worker doesn't expose an HTTP endpoint, but you can monitor:

1. **Redis Queue:**
   ```bash
   redis-cli
   > KEYS bull:video-processing:*
   ```

2. **Database:**
   ```sql
   SELECT status, COUNT(*) 
   FROM assignment_video_job 
   GROUP BY status;
   ```

3. **Process:**
   ```bash
   ps aux | grep tsx
   ```

## Scaling

### Horizontal Scaling

Run multiple worker instances:

```bash
# Instance 1
pm2 start ecosystem.config.js --name worker-1

# Instance 2
pm2 start ecosystem.config.js --name worker-2

# Instance 3
pm2 start ecosystem.config.js --name worker-3
```

Each worker will:
- Connect to the same Redis queue
- Process jobs concurrently
- Not interfere with each other

### Vertical Scaling

Adjust concurrency in `src/worker/index.ts`:

```typescript
const worker = new Worker('video-processing', processVideoJob, {
  connection,
  concurrency: 4, // Increase for more parallel jobs
});
```

**Guidelines:**
- 1-2 concurrent jobs per CPU core
- Monitor memory usage (video processing is memory-intensive)
- Consider file I/O limits

## Troubleshooting

### Worker not starting

**Check logs:**
```bash
npm run dev:worker
```

**Common issues:**
- ❌ Missing environment variables → Check `.env`
- ❌ Redis not running → Start Redis
- ❌ Database not accessible → Check `DATABASE_URL`
- ❌ FFmpeg not installed → Install FFmpeg

### Jobs not processing

**Check Redis:**
```bash
redis-cli
> KEYS bull:video-processing:*
> LLEN bull:video-processing:wait
```

**Check worker logs:**
- Look for "Processing video job" messages
- Check for errors

**Check database:**
```sql
SELECT * FROM assignment_video_job 
WHERE status = 'queued' 
ORDER BY "createdAt" DESC;
```

### High memory usage

**Solutions:**
1. Reduce concurrency
2. Add memory limit to PM2/Docker
3. Process smaller videos
4. Optimize FFmpeg settings

### FFmpeg errors

**Common issues:**
- ❌ File not found → Check R2 download
- ❌ Invalid format → Check video codec
- ❌ Out of memory → Reduce video size or concurrency

## Performance Optimization

### 1. Adjust Concurrency

```typescript
// Low-end server (2 cores, 4GB RAM)
concurrency: 1

// Mid-range server (4 cores, 8GB RAM)
concurrency: 2

// High-end server (8+ cores, 16GB+ RAM)
concurrency: 4
```

### 2. Rate Limiting

```typescript
limiter: {
  max: 10,      // Max jobs
  duration: 60000, // Per minute
}
```

### 3. Temp Directory

Use fast SSD for temp files:
```typescript
const TEMP_DIR = '/mnt/fast-ssd/video-processor';
```

### 4. FFmpeg Optimization

Use hardware acceleration if available:
```bash
# Check for hardware acceleration
ffmpeg -hwaccels
```

## Security

### 1. Isolate Worker

Run worker as separate user:
```bash
sudo useradd -r -s /bin/false video-worker
sudo chown -R video-worker:video-worker /var/www/assignment
```

### 2. Limit Resources

**Systemd:**
```ini
[Service]
MemoryLimit=2G
CPUQuota=200%
```

**Docker:**
```bash
docker run -d \
  --memory="2g" \
  --cpus="2" \
  video-worker
```

### 3. Secure Environment Variables

Don't commit `.env`:
```bash
# .gitignore
.env
.env.local
```

Use secret management:
- AWS Secrets Manager
- HashiCorp Vault
- Kubernetes Secrets

## Cost Optimization

### 1. Auto-scaling

Scale workers based on queue length:
```bash
# Check queue length
QUEUE_LENGTH=$(redis-cli LLEN bull:video-processing:wait)

# Scale up if queue is long
if [ $QUEUE_LENGTH -gt 10 ]; then
  pm2 scale video-worker +1
fi
```

### 2. Spot Instances

Use spot/preemptible instances for workers:
- Workers can be interrupted
- Jobs will be retried
- Significant cost savings

### 3. Scheduled Scaling

Scale down during off-peak hours:
```bash
# Crontab
0 22 * * * pm2 scale video-worker 1  # 10 PM: scale down
0 8 * * * pm2 scale video-worker 3   # 8 AM: scale up
```

## Summary

✅ **No build step** - Uses tsx directly
✅ **Simple deployment** - Just run with npm
✅ **Multiple options** - Docker, PM2, Systemd
✅ **Scalable** - Horizontal and vertical scaling
✅ **Production-ready** - With proper monitoring

The worker is ready for production deployment! 🚀

