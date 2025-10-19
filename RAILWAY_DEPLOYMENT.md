# Railway Deployment Guide

This guide walks you through deploying the Multi-Tenant Video Processor on Railway.

## Overview

Railway deployment consists of **4 services**:
1. **PostgreSQL** - Database
2. **Redis** - Queue backend
3. **Web** - Next.js application
4. **Worker** - FFmpeg video processing worker

## Prerequisites

- Railway account ([railway.app](https://railway.app))
- GitHub repository with your code
- All external services configured:
  - Google OAuth credentials
  - Cloudflare R2 bucket
  - Stripe account with product/price
  - Resend API key

## Step-by-Step Deployment

### 1. Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account and select your repository

### 2. Add PostgreSQL Database

1. In your Railway project, click "+ New"
2. Select "Database" → "Add PostgreSQL"
3. Railway will automatically:
   - Provision a PostgreSQL instance
   - Create `DATABASE_URL` environment variable
   - Make it available to all services

### 3. Add Redis

1. Click "+ New" again
2. Select "Database" → "Add Redis"
3. Railway will automatically:
   - Provision a Redis instance
   - Create `REDIS_URL` environment variable
   - Make it available to all services

### 4. Configure Web Service

The web service is automatically created when you connect your GitHub repo.

**Settings:**

1. **Build Configuration**
   - Build Command: `npm install && npm run db:push && npm run build`
   - Start Command: `npm run start`

2. **Environment Variables**
   Add these in the "Variables" tab:

   ```
   NODE_ENV=production
   
   # NextAuth
   NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
   NEXTAUTH_URL=https://your-app.railway.app
   
   # Google OAuth
   GOOGLE_CLIENT_ID=<your-google-client-id>
   GOOGLE_CLIENT_SECRET=<your-google-client-secret>
   
   # Cloudflare R2
   R2_ACCOUNT_ID=<your-account-id>
   R2_ACCESS_KEY_ID=<your-access-key>
   R2_SECRET_ACCESS_KEY=<your-secret-key>
   R2_BUCKET_NAME=<your-bucket>
   R2_PUBLIC_URL=https://<your-bucket>.r2.dev
   
   # Stripe
   STRIPE_SECRET_KEY=<your-stripe-secret-key>
   STRIPE_WEBHOOK_SECRET=<your-webhook-secret>
   STRIPE_PRICE_ID=<your-price-id>
   
   # Resend
   RESEND_API_KEY=<your-resend-key>
   EMAIL_FROM=noreply@yourdomain.com
   
   # App URL
   NEXT_PUBLIC_APP_URL=https://your-app.railway.app
   ```

   Note: `DATABASE_URL` and `REDIS_URL` are automatically provided by Railway.

3. **Custom Domain (Optional)**
   - Go to "Settings" → "Domains"
   - Click "Generate Domain" or add your custom domain
   - Update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` with your domain

### 5. Configure Worker Service

The worker service needs to be created separately from the same GitHub repo.

**Why separate?** The worker runs FFmpeg processing in the background. It needs to:
- Run independently from the web server
- Scale separately based on video processing load
- Restart without affecting web traffic

**Setup Steps:**

1. **Create Worker Service**
   - Click "+ New" → "GitHub Repo"
   - Select the **same repository** as your web service
   - Railway will create a second service

2. **Configure Settings**
   
   Go to the new service's Settings:
   
   - **Service Name**: Rename to "worker" (for clarity)
   - **Root Directory**: Keep as `/` (same as web service)
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:worker`
   - **Watch Paths**: (Optional) Add `src/worker/**` to only redeploy on worker changes

3. **Environment Variables**
   
   The worker needs the **exact same environment variables** as the web service:
   
   ```bash
   # Copy all variables from web service
   # Railway automatically provides DATABASE_URL and REDIS_URL
   ```
   
   **Quick Copy Method:**
   - Go to Web service → Variables tab
   - Copy all variables
   - Go to Worker service → Variables tab
   - Paste them all
   
   ⚠️ **Important**: Both services must use the **same** `DATABASE_URL` and `REDIS_URL`

4. **FFmpeg Availability**
   
   Railway's Nixpacks automatically includes FFmpeg. No extra configuration needed!
   
   To verify, check worker logs after deployment - you should see:
   ```
   Video processing worker started
   Connected to Redis: redis://...
   ```

5. **Service Configuration File (Optional)**
   
   You can use `railway.worker.json` for advanced configuration:
   ```json
   {
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "startCommand": "npm run start:worker",
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10
     }
   }
   ```
   
   Place this file in your repo root and reference it in Railway settings.

### 6. Test the Deployment

After both services are deployed:

1. **Test Web Service**
   - Visit your Railway URL
   - Sign in with Google
   - Navigate to dashboard

2. **Test Worker Service**
   - Check worker logs: should see "Video processing worker started"
   - Upload a test video
   - Watch worker logs for processing activity
   - Verify job completes and email is sent

### 7. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to "APIs & Services" → "Credentials"
3. Edit your OAuth 2.0 Client ID
4. Add Authorized redirect URIs:
   ```
   https://your-app.railway.app/api/auth/callback/google
   ```

### 8. Configure Stripe Webhook

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to "Developers" → "Webhooks"
3. Click "Add endpoint"
4. Enter URL: `https://your-app.railway.app/api/webhooks/stripe`
5. Select events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `checkout.session.async_payment_failed`
6. Copy the webhook signing secret
7. Add it to Railway as `STRIPE_WEBHOOK_SECRET`

### 9. Database Migrations

Database schema is pushed automatically during build (`npm run db:push`).

To run migrations manually:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Select the web service
railway service

# Run migration
railway run npm run db:push
```

### 10. Verify Deployment

1. **Check Web Service**
   - Visit your Railway URL
   - You should see the landing page
   - Try signing in with Google

2. **Check Worker Service**
   - View worker logs in Railway dashboard
   - Should see "Video processing worker started"

3. **Test Video Upload**
   - Sign in and upload a test video
   - Check worker logs for processing activity
   - Verify email notification

## Monitoring

### Logs

View logs for each service in Railway dashboard:
- Web logs: API requests, tRPC calls
- Worker logs: Job processing, FFmpeg output

### Metrics

Railway provides:
- CPU usage
- Memory usage
- Network traffic
- Build times

## Scaling

### Web Service

1. Go to service settings
2. Under "Replicas", increase count
3. Railway will load balance automatically

### Worker Service

1. Increase replicas for parallel video processing
2. Adjust `concurrency` in `src/worker/index.ts` if needed

### Database

Railway automatically scales PostgreSQL. For more performance:
1. Upgrade to a higher plan
2. Add read replicas (available on Pro plan)

## Troubleshooting

### Build Fails

**Issue**: Build command fails

**Solutions**:
- Check environment variables are set
- Verify `DATABASE_URL` is accessible
- Check build logs for specific errors

### Worker Not Processing Jobs

**Issue**: Videos stuck in "queued" status

**Solutions**:
- Check worker service is running
- Verify `REDIS_URL` matches between web and worker
- Check worker logs for errors
- Ensure FFmpeg is available

### Videos Not Uploading

**Issue**: Upload fails or times out

**Solutions**:
- Verify R2 credentials are correct
- Check bucket CORS configuration
- Ensure R2 bucket allows public writes (presigned URLs)

### Emails Not Sending

**Issue**: No email notifications

**Solutions**:
- Verify Resend API key
- Check email domain is verified in Resend
- Review worker logs for email errors

### Stripe Webhook Fails

**Issue**: Credits not added after payment

**Solutions**:
- Verify webhook secret matches Stripe
- Check webhook URL is correct
- Review web service logs for webhook errors
- Test webhook in Stripe dashboard

## Environment Variables Checklist

- [ ] `DATABASE_URL` (auto-provided by Railway)
- [ ] `REDIS_URL` (auto-provided by Railway)
- [ ] `NEXTAUTH_SECRET`
- [ ] `NEXTAUTH_URL`
- [ ] `GOOGLE_CLIENT_ID`
- [ ] `GOOGLE_CLIENT_SECRET`
- [ ] `R2_ACCOUNT_ID`
- [ ] `R2_ACCESS_KEY_ID`
- [ ] `R2_SECRET_ACCESS_KEY`
- [ ] `R2_BUCKET_NAME`
- [ ] `R2_PUBLIC_URL`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `STRIPE_PRICE_ID`
- [ ] `RESEND_API_KEY`
- [ ] `EMAIL_FROM`
- [ ] `NEXT_PUBLIC_APP_URL`

## Cost Estimation

Railway pricing (as of 2024):
- Hobby Plan: $5/month + usage
- Pro Plan: $20/month + usage

Estimated monthly costs:
- PostgreSQL: ~$5-10
- Redis: ~$5-10
- Web Service: ~$5-15
- Worker Service: ~$10-30 (depending on video volume)

**Total: ~$25-65/month** for moderate usage

## Backup Strategy

### Database Backups

Railway Pro plan includes automatic backups. To backup manually:

```bash
# Install Railway CLI
railway login
railway link

# Create backup
railway pg:dump > backup.sql

# Restore backup
railway pg:restore < backup.sql
```

### R2 Backups

Videos in R2 are persistent. Consider:
- Versioning (enable in R2 bucket settings)
- Cross-region replication
- Regular downloads of important videos

## Production Checklist

Before going live:

- [ ] All environment variables set correctly
- [ ] Google OAuth callback URLs configured
- [ ] Stripe webhook configured and tested
- [ ] Custom domain configured
- [ ] SSL certificate active (automatic on Railway)
- [ ] Test complete video upload flow
- [ ] Test payment flow
- [ ] Verify email notifications
- [ ] Set up monitoring/alerts
- [ ] Review security settings
- [ ] Database backups configured

## Support

For Railway-specific issues:
- [Railway Documentation](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)

For application issues:
- Check application logs
- Review README.md
- Open GitHub issue

