# R2 CORS Error Fix

## Problem

You were getting a CORS error: `PreFlightMissingAllowOriginHeader` when trying to upload files to Cloudflare R2.

## Root Causes

1. **Presigned URL Content-Type Mismatch**: The presigned URL was generated without specifying a Content-Type, but the upload request was sending `Content-Type: video/mp4`. This causes a signature mismatch and CORS preflight failure.

2. **CORS Configuration Issue**: Your R2 CORS config had a trailing slash in one origin:
   ```json
   "http://localhost:3000/"  ❌ (trailing slash)
   "http://localhost:3000"   ✅ (correct)
   ```

3. **Missing AllowedHeaders**: R2 CORS needs to explicitly allow the `Content-Type` header.

## Solution

### 1. Updated Code to Match Content-Type

I've updated the following files:

**`src/server/storage/r2.ts`**
- Modified `generatePresignedUploadUrl()` to accept and include `contentType`
- Ensures presigned URL signature includes the Content-Type that will be used

**`src/server/api/routers/video.ts`**
- Added `fileType` to input schema
- Passes content type to presigned URL generation
- Returns `contentType` to frontend

**`src/app/dashboard/page.tsx`**
- Passes file type when requesting upload URL
- Uses the returned `contentType` in the upload request
- Ensures Content-Type matches between presigned URL and actual upload

### 2. Corrected R2 CORS Configuration

Update your R2 bucket CORS configuration to this:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://yourdomain.com"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD",
      "PUT",
      "POST"
    ],
    "AllowedHeaders": [
      "Content-Type",
      "Content-Length",
      "Range"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

**Key changes:**
- ❌ Removed trailing slash from `http://localhost:3000/`
- ✅ Added `AllowedHeaders` including `Content-Type`
- ✅ Added `HEAD` method (needed for preflight)
- ✅ Added `ExposeHeaders` for upload responses
- ✅ Added `MaxAgeSeconds` to cache preflight responses

## How to Update R2 CORS Configuration

### Option 1: Using Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** in the sidebar
3. Click on your bucket name
4. Go to **Settings** tab
5. Scroll down to **CORS Policy**
6. Click **Edit CORS Policy**
7. Replace with the configuration above (adjust domains as needed)
8. Click **Save**

### Option 2: Using Wrangler CLI

Create a file `cors-config.json`:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://yourdomain.com"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD",
      "PUT",
      "POST"
    ],
    "AllowedHeaders": [
      "Content-Type",
      "Content-Length",
      "Range"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

Then run:

```bash
wrangler r2 bucket cors put YOUR_BUCKET_NAME --config cors-config.json
```

### Option 3: Using AWS CLI (S3 Compatible)

Create a file `cors-config.json` with the same content as above, then:

```bash
aws s3api put-bucket-cors \
  --bucket YOUR_BUCKET_NAME \
  --cors-configuration file://cors-config.json \
  --endpoint-url https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
```

## Testing the Fix

### 1. Restart Your Dev Server

```bash
npm run dev
```

### 2. Test Upload

1. Go to your dashboard
2. Select a video file
3. Click upload
4. Check browser console for any CORS errors

### 3. Check Network Tab

In Chrome DevTools Network tab, you should see:

1. **OPTIONS request** (preflight) - Status: 200
   - Response headers should include:
     - `Access-Control-Allow-Origin: http://localhost:3000`
     - `Access-Control-Allow-Methods: GET, HEAD, PUT, POST`
     - `Access-Control-Allow-Headers: Content-Type, Content-Length, Range`

2. **PUT request** (actual upload) - Status: 200
   - Request headers should include:
     - `Content-Type: video/mp4` (or whatever your file type is)

## Common CORS Errors & Solutions

### Error: "PreFlightMissingAllowOriginHeader"

**Cause**: Preflight OPTIONS request is failing
**Solution**: 
- Ensure `AllowedOrigins` includes your domain (no trailing slash!)
- Ensure `AllowedMethods` includes "HEAD" and "PUT"
- Ensure `AllowedHeaders` includes "Content-Type"

### Error: "Response to preflight request doesn't pass access control check"

**Cause**: The actual origin doesn't match allowed origins
**Solution**:
- Check for trailing slashes in origins
- Ensure protocol matches (http vs https)
- Check for port number mismatches

### Error: "Method PUT is not allowed by Access-Control-Allow-Methods"

**Cause**: PUT method not allowed in CORS
**Solution**: Add "PUT" to `AllowedMethods`

### Error: "Request header field content-type is not allowed"

**Cause**: Content-Type not in allowed headers
**Solution**: Add "Content-Type" to `AllowedHeaders`

### Error: "Signature mismatch" or "Access Denied"

**Cause**: Content-Type in upload doesn't match presigned URL
**Solution**: This is now fixed - restart your server to use the updated code

## For Production Deployment

When deploying to production, update the CORS configuration:

```json
[
  {
    "AllowedOrigins": [
      "https://yourdomain.com",
      "https://www.yourdomain.com"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD",
      "PUT",
      "POST"
    ],
    "AllowedHeaders": [
      "Content-Type",
      "Content-Length",
      "Range"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

**Security Notes:**
- Use specific origins instead of `"*"`
- Use HTTPS in production
- Don't include localhost in production CORS config
- Consider using environment-specific CORS configs

## Verification Checklist

After making changes, verify:

- ✅ R2 CORS config updated (no trailing slashes)
- ✅ Dev server restarted
- ✅ Browser cache cleared
- ✅ Test file upload works
- ✅ No CORS errors in console
- ✅ Upload completes successfully

## Additional Tips

### Clear Browser Cache

Sometimes old CORS preflight responses are cached:

```bash
# Chrome
Cmd/Ctrl + Shift + Del → Clear cached images and files

# Or use Incognito mode for testing
```

### Test with curl

You can test the presigned URL with curl:

```bash
# Get presigned URL from your app, then:
curl -X PUT \
  -H "Content-Type: video/mp4" \
  --data-binary @test-video.mp4 \
  "YOUR_PRESIGNED_URL"
```

If this works but browser doesn't, it's definitely a CORS issue.

### Enable Verbose Logging

Add this to your upload code temporarily:

```typescript
console.log("Upload URL:", uploadUrl);
console.log("Content-Type:", contentType);
console.log("File type:", selectedFile.type);
```

This helps debug Content-Type mismatches.

## What Changed in the Code

### Before (❌):
```typescript
// Generated presigned URL without Content-Type
const uploadUrl = await generatePresignedUploadUrl(fileKey, 3600);

// Frontend sent different Content-Type
headers: {
  "Content-Type": selectedFile.type || "video/mp4"
}
// ❌ SIGNATURE MISMATCH!
```

### After (✅):
```typescript
// Generate presigned URL WITH Content-Type
const uploadUrl = await generatePresignedUploadUrl(
  fileKey, 
  selectedFile.type || "application/octet-stream",
  3600
);

// Frontend sends SAME Content-Type
headers: {
  "Content-Type": contentType  // Matches presigned URL
}
// ✅ SIGNATURES MATCH!
```

## Summary

The fix involves two parts:

1. **Code Changes** (Already done ✅):
   - Presigned URL now includes Content-Type
   - Frontend uses the same Content-Type from backend
   - Ensures signature consistency

2. **R2 CORS Config** (You need to do this):
   - Remove trailing slashes from origins
   - Add required headers
   - Add HEAD method
   - Configure proper CORS policy

After updating R2 CORS config and restarting your server, uploads should work! 🎉

