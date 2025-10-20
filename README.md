# Multi-Tenant Video Processor

A full-stack SaaS application that automatically removes silences from videos using FFmpeg, with multi-tenancy, Stripe payments, and white-label support.

## Features

- 🎥 **Automatic Silence Removal** - Upload videos and automatically remove silent parts
- 👥 **Multi-Tenancy** - Support for multiple workspaces with custom domains
- 💳 **Stripe Integration** - Purchase credits via Stripe Checkout
- 🎨 **White-Label Support** - Complete white-labeling with DNS verification
  - Custom logos per workspace
  - Custom primary colors
  - Branded landing pages
  - Branded email notifications
- 📧 **Email Notifications** - Get notified when video processing is complete
- 🔐 **Google OAuth** - Secure authentication with NextAuth.js
- ⚡ **Background Processing** - BullMQ + Redis for scalable video processing
- 💾 **Cloud Storage** - Cloudflare R2 (S3-compatible) for video files

## Tech Stack

- **Frontend**: Next.js 15, React 19, TailwindCSS
- **Backend**: tRPC, Next.js API Routes
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: NextAuth.js with Google OAuth
- **Queue**: BullMQ + Redis
- **Storage**: Cloudflare R2
- **Payments**: Stripe
- **Email**: Resend
- **Video Processing**: FFmpeg
- **Deployment**: Railway (Web + Worker)



## Project Structure

```
src/
├── app/                      # Next.js App Router
│   ├── api/
│   │   ├── auth/            # NextAuth routes
│   │   ├── trpc/            # tRPC API handler
│   │   └── webhooks/        # Stripe webhooks
│   ├── auth/                # Authentication pages
│   ├── dashboard/           # Dashboard pages
│   ├── settings/            # Settings page
│   ├── _components/         # Shared components
│   └── layout.tsx
├── server/
│   ├── api/
│   │   ├── routers/         # tRPC routers
│   │   ├── root.ts
│   │   └── trpc.ts          # tRPC setup & middleware
│   ├── db/
│   │   ├── index.ts
│   │   └── schema.ts        # Database schema
│   ├── storage/             # R2 client
│   ├── queue/               # BullMQ setup
│   ├── email/               # Email templates
│   └── auth.ts              # NextAuth config
├── worker/
│   └── index.ts             # Video processing worker
├── trpc/                    # tRPC React client
└── env.js                   # Environment validation
```

### Architecture Overview

```
Railway Project
├── PostgreSQL (database)
├── Redis (job queue)
├── Web Service (Next.js) ← Handles HTTP requests
└── Worker Service (FFmpeg) ← Processes videos in background
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL
- Redis
- FFmpeg (for local worker development)
- Google OAuth credentials
- Cloudflare R2 bucket
- Stripe account
- Resend account

### Installation

1. **Clone the repository**

```bash
git clone <repo-url>
cd assignment
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Create a `.env` file based on `.env.example`:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# Redis
REDIS_URL="redis://localhost:6379"

# NextAuth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Cloudflare R2
R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-access-key-id"
R2_SECRET_ACCESS_KEY="your-secret-access-key"
R2_BUCKET_NAME="your-bucket-name"
R2_PUBLIC_URL="https://your-bucket.r2.dev"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_ID="price_..."

# Resend
RESEND_API_KEY="re_..."
EMAIL_FROM="noreply@yourdomain.com"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

4. **Set up the database**

```bash
npm run db:push
```

5. **Run the development server**

```bash
# Terminal 1: Web server
npm run dev

# Terminal 2: Worker (requires FFmpeg installed)
npm run dev:worker
```

6. **Open the app**

Navigate to [http://localhost:3000](http://localhost:3000)

## Deployment on Railway

### Prerequisites

1. Create a Railway account
2. Install Railway CLI: `npm i -g @railway/cli`

### Setup

1. **Create a new Railway project**

```bash
railway init
```

2. **Add services:**

   - **PostgreSQL** - Add from Railway marketplace
   - **Redis** - Add from Railway marketplace
   - **Web Service** - Deploy from GitHub
   - **Worker Service** - Deploy from GitHub

3. **Configure Web Service:**

   - Build Command: `npm install && npm run db:push && npm run build`
   - Start Command: `npm run start`
   - Add all environment variables from `.env`
   - Set `PORT` variable (Railway provides this automatically)

4. **Configure Worker Service:**

   - Build Command: `npm install && npm run build:worker`
   - Start Command: `npm run start:worker`
   - Add all environment variables from `.env`
   - Ensure FFmpeg is available (Railway includes it by default with Nixpacks)

5. **Set up environment variables:**

   Add all variables from your `.env` file to both services. Railway automatically provides:
   - `DATABASE_URL` (from PostgreSQL service)
   - `REDIS_URL` (from Redis service)

6. **Configure domains:**

   - Set up your custom domain in Railway settings
   - Update `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` to your production domain

7. **Set up Stripe webhook:**

   - Go to Stripe Dashboard → Webhooks
   - Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
   - Select events: `checkout.session.completed`, `checkout.session.expired`
   - Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

### Database Migrations

```bash
# Generate migration
npm run db:generate

# Push to database
npm run db:push
```

## Architecture

### Multi-Tenancy

The app supports multi-tenancy through:

1. **Middleware** - Resolves workspace from custom domain
2. **Database** - Workspaces, memberships, and user relationships
3. **tRPC Context** - Workspace data available in all procedures

### Video Processing Flow

1. User uploads video → presigned R2 URL generated
2. Client uploads directly to R2
3. Job created in database, credit deducted
4. Job added to BullMQ queue
5. Worker picks up job:
   - Downloads video from R2
   - Detects silences with FFmpeg
   - Removes silent segments
   - Concatenates non-silent parts
   - Uploads processed video to R2
   - Updates job status
   - Sends email notification
6. User downloads processed video

### White-Label Features

- Custom logos per workspace
- Custom primary color (applied globally)
- Custom domains (configure in settings)
- Branded email notifications

## API Routes

### tRPC Routers

- **video** - Upload, confirm, list jobs, get status, check credits
- **workspace** - Get workspaces, update settings, create workspace
- **payment** - Create Stripe checkout session

### REST Endpoints

- `POST /api/webhooks/stripe` - Stripe webhook handler
- `GET/POST /api/auth/*` - NextAuth routes
- `GET/POST /api/trpc/*` - tRPC handler

## Scripts

```bash
npm run dev              # Start Next.js dev server
npm run dev:worker       # Start worker in dev mode
npm run build            # Build Next.js app
npm run build:worker     # Build worker
npm run start            # Start production server
npm run start:worker     # Start production worker
npm run db:push          # Push schema to database
npm run db:generate      # Generate migrations
npm run db:studio        # Open Drizzle Studio
npm run lint             # Run ESLint
npm run format:check     # Check formatting
npm run format:write     # Format code
```

## Environment Variables Reference

See `.env.example` for all required variables.

## Credits System

- New workspaces get 1 free credit
- Each video processing job costs 1 credit
- Credits refunded if job fails
- Purchase 100 credits via Stripe (price configured in Stripe Dashboard)

## Security

- Videos stored in private R2 bucket
- Presigned URLs for secure upload/download
- User authentication required for all operations
- Workspace access verified via membership
- Stripe webhook signature verification

## License

MIT

## Support

For issues and questions, please open a GitHub issue.
