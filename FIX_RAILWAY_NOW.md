# Fix Railway FFmpeg Error NOW

## Your Current Error

```
Error: spawn ffprobe ENOENT
```

**Problem:** FFmpeg is not installed on Railway.

## Quick Fix (2 Minutes)

### Step 1: Commit the Config Files (30 seconds)

The files are already created in your repo. Just commit and push:

```bash
git add nixpacks.toml nixpacks.worker.toml railway.worker.json
git commit -m "Add FFmpeg to Railway worker"
git push
```

### Step 2: Configure Railway (1 minute)

1. Go to [Railway Dashboard](https://railway.app)
2. Open your project
3. Click on your **Worker service**
4. Go to **Settings**
5. Scroll to **"Nixpacks Config Path"**
6. Enter: `nixpacks.worker.toml`
7. Click **Save**

### Step 3: Wait for Redeploy (1 minute)

Railway will automatically redeploy your worker.

Watch the **Build Logs**:
- Should see: "Installing packages: nodejs-20_x ffmpeg-full"
- Wait for: "Build completed"

### Step 4: Verify (30 seconds)

Check the **Worker Logs**:
- Should see: "Video processing worker started"
- Upload a test video
- Should process successfully

## That's It! ✅

Your worker now has FFmpeg and can process videos.

## What These Files Do

**nixpacks.worker.toml:**
```toml
[phases.setup]
nixPkgs = ['nodejs-20_x', 'ffmpeg-full']
```
↑ Tells Railway: "Install FFmpeg when building the worker"

**railway.worker.json:**
```json
{
  "build": {
    "nixpacksConfigPath": "nixpacks.worker.toml"
  }
}
```
↑ Tells Railway: "Use the worker config for this service"

## If It Still Doesn't Work

1. **Clear build cache:**
   - Railway Settings → "Clear Build Cache"
   - Trigger new deployment

2. **Check the file was committed:**
   ```bash
   git ls-files | grep nixpacks
   ```
   Should show: `nixpacks.toml` and `nixpacks.worker.toml`

3. **Check Railway settings:**
   - Verify "Nixpacks Config Path" is set
   - Should be exactly: `nixpacks.worker.toml`

## Need More Help?

See detailed guide: [RAILWAY_FFMPEG_FIX.md](./RAILWAY_FFMPEG_FIX.md)

---

**TL;DR:**
```bash
# 1. Push the config files
git add nixpacks.* railway.worker.json
git commit -m "Add FFmpeg"
git push

# 2. In Railway Dashboard:
#    Worker Settings → Nixpacks Config Path → "nixpacks.worker.toml"

# 3. Wait for redeploy, then test!
```

