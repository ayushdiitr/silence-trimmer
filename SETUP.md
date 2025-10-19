# Quick Setup Guide

This guide helps you get the application running locally for development.

## Prerequisites Install

### 1. Node.js & npm
```bash
# Check if installed
node --version  # Should be 20+
npm --version

# Install via nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

### 2. PostgreSQL
```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# Linux (Ubuntu/Debian)
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql

# Create database
createdb video_processor
```

### 3. Redis
```bash
# macOS
brew install redis
brew services start redis

# Linux (Ubuntu/Debian)
sudo apt-get install redis-server
sudo systemctl start redis

# Verify
redis-cli ping  # Should return PONG
```

### 4. FFmpeg
```bash
# macOS
brew install ffmpeg

# Linux (Ubuntu/Debian)
sudo apt-get install ffmpeg

# Verify
ffmpeg -version
```

## External Services Setup

### 1. Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable "Google+ API"
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Client Secret

### 2. Cloudflare R2

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to R2 Object Storage
3. Create a new bucket (e.g., `video-processor-dev`)
4. Create API token with R2 read/write permissions
5. Note down:
   - Account ID
   - Access Key ID
   - Secret Access Key
   - Bucket name
   - Public URL (or use `.r2.dev` URL)

### 3. Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Get your test API key from "Developers" → "API keys"
3. Create a product:
   - Go to "Products" → "Add product"
   - Name: "100 Video Credits"
   - Price: $9.99 (or your choice)
   - Type: One-time payment
4. Copy the Price ID
5. For webhooks (local testing):
   ```bash
   # Install Stripe CLI
   brew install stripe/stripe-cli/stripe
   
   # Login
   stripe login
   
   # Forward webhooks to local
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
6. Copy the webhook signing secret from CLI output

### 4. Resend

1. Go to [Resend](https://resend.com)
2. Create account and verify email domain
3. Get API key from dashboard
4. Note your verified sender email

## Application Setup

### 1. Clone & Install

```bash
git clone <your-repo>
cd assignment
npm install
```

### 2. Environment Variables

Create `.env` file:

```bash
# Database (adjust if needed)
DATABASE_URL="postgresql://localhost:5432/video_processor"

# Redis
REDIS_URL="redis://localhost:6379"

# Generate secret (run this command)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (from step 1)
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"

# Cloudflare R2 (from step 2)
R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-access-key"
R2_SECRET_ACCESS_KEY="your-secret-key"
R2_BUCKET_NAME="video-processor-dev"
R2_PUBLIC_URL="https://your-bucket.r2.dev"

# Stripe (from step 3)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."  # From Stripe CLI
STRIPE_PRICE_ID="price_..."

# Resend (from step 4)
RESEND_API_KEY="re_..."
EMAIL_FROM="noreply@yourdomain.com"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Initialize Database

```bash
npm run db:push
```

This creates all necessary tables.

### 4. Start Development Servers

You need **3 terminal windows**:

**Terminal 1: Next.js Web Server**
```bash
npm run dev
```

**Terminal 2: Video Processing Worker**
```bash
npm run dev:worker
```

**Terminal 3: Stripe Webhook Listener (if testing payments)**
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### 5. Access Application

Open browser to [http://localhost:3000](http://localhost:3000)

## Testing the Application

### 1. Sign Up Flow

1. Go to http://localhost:3000
2. Click "Get Started Free"
3. Sign in with Google
4. You'll be redirected to dashboard with 1 free credit

### 2. Upload Video

1. Click "Upload Video"
2. Select an MP4 file (max 300MB)
3. Click "Upload and Process"
4. Watch the job status change: queued → processing → completed

### 3. Test Payments (Optional)

1. Click "Buy Credits"
2. Use Stripe test card: `4242 4242 4242 4242`
3. Any future date, any CVC
4. Complete checkout
5. You should receive 100 credits

### 4. Test White-Label

1. Go to Settings
2. Change workspace name, logo URL, and primary color
3. Save changes
4. Navigate around to see changes applied

## Troubleshooting

### Database Connection Error

```bash
# Check PostgreSQL is running
pg_isready

# Create database if missing
createdb video_processor

# Check DATABASE_URL in .env
```

### Redis Connection Error

```bash
# Check Redis is running
redis-cli ping

# Start Redis
brew services start redis  # macOS
sudo systemctl start redis  # Linux
```

### Worker Not Processing Jobs

1. Check worker terminal for errors
2. Verify FFmpeg is installed: `ffmpeg -version`
3. Check Redis URL matches in both web and worker
4. Check worker logs for specific errors

### Upload Fails

1. Verify R2 credentials in `.env`
2. Check R2 bucket exists
3. Test R2 connection:
   ```bash
   npm run db:studio
   # Check if uploads table has entries
   ```

### Google OAuth Fails

1. Verify redirect URI in Google Console exactly matches:
   `http://localhost:3000/api/auth/callback/google`
2. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
3. Clear browser cookies and try again

## Development Tips

### Database Management

```bash
# Open Drizzle Studio (visual database editor)
npm run db:studio

# Generate migration files
npm run db:generate

# Push schema changes
npm run db:push
```

### Code Quality

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format:write

# Type checking
npm run typecheck
```

### Debugging

1. **Web Server**: Check terminal output and browser console
2. **Worker**: Check worker terminal for FFmpeg output
3. **Database**: Use Drizzle Studio (`npm run db:studio`)
4. **Redis**: Use `redis-cli monitor` to see queue activity

## Next Steps

- Review `README.md` for full documentation
- Check `RAILWAY_DEPLOYMENT.md` for production deployment
- Explore code in `src/` directory
- Customize for your use case

## Common Issues

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Module Not Found Errors

```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

### FFmpeg Not Found

```bash
# Check installation
which ffmpeg

# Reinstall
brew reinstall ffmpeg  # macOS
sudo apt-get install --reinstall ffmpeg  # Linux
```

## Support

For issues:
1. Check this guide
2. Review error messages carefully
3. Check application logs
4. Open GitHub issue with details

