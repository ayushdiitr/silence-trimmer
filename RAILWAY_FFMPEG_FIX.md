# Railway FFmpeg Fix

## Problem

When deploying the worker to Railway, you get this error:

```
Error: spawn ffprobe ENOENT
  errno: -2,
  code: 'ENOENT',
  syscall: 'spawn ffprobe',
  path: 'ffprobe',
```

**Cause:** FFmpeg is not installed in the Railway container.

## Solution

Add a `nixpacks.toml` file to tell Railway's Nixpacks builder to include FFmpeg.

### Files Created

1. **`nixpacks.toml`** - For web service (includes FFmpeg just in case)
2. **`nixpacks.worker.toml`** - For worker service (definitely needs FFmpeg)

### Configuration

**nixpacks.worker.toml:**
```toml
[phases.setup]
nixPkgs = ['nodejs-20_x', 'ffmpeg-full']

[phases.install]
cmds = ['npm ci']

[start]
cmd = 'npm run start:worker'
```

This tells Railway to:
- ✅ Install Node.js 20
- ✅ Install FFmpeg (full version with all codecs)
- ✅ Run `npm ci` to install dependencies
- ✅ Start with `npm run start:worker`

## How to Apply

### Option 1: Via Railway Dashboard (Recommended)

1. **Commit the new files to your repo:**
   ```bash
   git add nixpacks.toml nixpacks.worker.toml railway.worker.json
   git commit -m "Add FFmpeg to Railway worker"
   git push
   ```

2. **Configure Worker Service:**
   - Go to Railway Dashboard
   - Click on your **Worker service**
   - Go to **Settings**
   - Find **"Nixpacks Config Path"**
   - Set it to: `nixpacks.worker.toml`
   - Save

3. **Redeploy:**
   - Railway will automatically redeploy after you push
   - Or manually trigger: Settings → Click "Redeploy"

4. **Verify:**
   - Check worker logs
   - Should see: "Video processing worker started"
   - Upload a test video
   - Should process successfully

### Option 2: Via railway.worker.json (Already Done)

The `railway.worker.json` file already references `nixpacks.worker.toml`:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "nixpacksConfigPath": "nixpacks.worker.toml"
  },
  "deploy": {
    "startCommand": "npm run start:worker"
  }
}
```

Just push to GitHub and Railway will use this config automatically.

## Verification

After redeploying, check the build logs. You should see:

```
Installing packages: nodejs-20_x ffmpeg-full
✓ FFmpeg installed successfully
```

And in the worker logs:

```
Video processing worker started
Connected to Redis: redis://...
Temp directory: /tmp/video-processor
```

When processing a video:

```
Processing video job <id>
Detecting silence with FFmpeg...
Removing silence...
Stitching segments...
Job completed successfully
```

## Why ffmpeg-full?

Railway's Nixpacks has two FFmpeg packages:
- `ffmpeg` - Basic version (missing some codecs)
- `ffmpeg-full` - Complete version with all codecs

We use `ffmpeg-full` to ensure all video formats are supported.

## What About Web Service?

The web service doesn't need FFmpeg (it only handles HTTP requests), but we added `nixpacks.toml` anyway for consistency. It won't hurt to have it.

If you want to save build time, you can use this simpler version for web:

**nixpacks.toml (web service):**
```toml
[phases.setup]
nixPkgs = ['nodejs-20_x']

[phases.install]
cmds = ['npm ci']

[phases.build]
cmds = ['npm run build']

[start]
cmd = 'npm run start'
```

## Troubleshooting

### Still getting ENOENT error?

1. **Check Railway build logs:**
   - Go to Worker service → Deployments → Latest
   - Check "Build Logs"
   - Verify FFmpeg was installed

2. **Verify config path:**
   - Settings → Nixpacks Config Path
   - Should be: `nixpacks.worker.toml`

3. **Check file is committed:**
   ```bash
   git ls-files | grep nixpacks
   # Should show both files
   ```

4. **Force rebuild:**
   - Settings → "Clear Build Cache"
   - Trigger new deployment

### FFmpeg installed but still fails?

Check the FFmpeg command in worker logs. If you see specific codec errors:

```toml
# Try specifying exact FFmpeg version
[phases.setup]
nixPkgs = ['nodejs-20_x', 'ffmpeg-full_6']
```

### Build takes too long?

FFmpeg is a large package (~100MB). Build time is normal:
- First build: 2-5 minutes
- Subsequent builds: 1-2 minutes (cached)

## Alternative: Docker Deployment

If you prefer more control, you can use Docker instead:

**Dockerfile.worker:**
```dockerfile
FROM node:20-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

CMD ["npm", "run", "start:worker"]
```

Then in Railway:
- Use "Deploy from Dockerfile"
- Point to `Dockerfile.worker`

## Summary

✅ **Problem:** FFmpeg not installed on Railway
✅ **Solution:** Add `nixpacks.worker.toml` with `ffmpeg-full`
✅ **Apply:** Push to GitHub, configure in Railway settings
✅ **Verify:** Check build logs and test video processing

After applying this fix, your worker will have FFmpeg and can process videos! 🎉

## Related Documentation

- [RAILWAY_WORKER_SETUP.md](./RAILWAY_WORKER_SETUP.md) - Complete worker setup
- [WORKER_DEPLOYMENT.md](./WORKER_DEPLOYMENT.md) - Alternative deployment options
- [Railway Nixpacks Docs](https://nixpacks.com/docs)

