# System Architecture

## Overview

The video processing platform consists of multiple independent services working together.

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Railway Project                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐ │
│  │              │      │              │      │              │ │
│  │ PostgreSQL   │◄─────┤  Web Service │      │    Worker    │ │
│  │   Database   │      │  (Next.js)   │      │   Service    │ │
│  │              │      │              │      │   (FFmpeg)   │ │
│  └──────────────┘      └──────┬───────┘      └──────┬───────┘ │
│         ▲                     │                     │          │
│         │                     │                     │          │
│         │                     ▼                     ▼          │
│         │              ┌──────────────┐                        │
│         └──────────────┤    Redis     │◄───────────────────────┤
│                        │    Queue     │                        │
│                        └──────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

                              │
                              │ HTTP Requests
                              ▼

                    ┌──────────────────┐
                    │      Users       │
                    └──────────────────┘

                              │
                              │ Upload/Download Videos
                              ▼

                    ┌──────────────────┐
                    │  Cloudflare R2   │
                    │  (File Storage)  │
                    └──────────────────┘
```

## Data Flow

### 1. Video Upload Flow

```
User Browser
    │
    │ 1. Request upload URL
    ├───────────────────────────►  Web Service (Next.js)
    │                                    │
    │                                    │ 2. Generate presigned URL
    │                                    │    Create job record (status: pending)
    │                                    ▼
    │                              Database (PostgreSQL)
    │                                    │
    │ 3. Return presigned URL            │
    ◄───────────────────────────┤        │
    │                                    │
    │ 4. Upload video directly           │
    ├──────────────────────────►  Cloudflare R2
    │                                    │
    │ 5. Confirm upload                  │
    ├───────────────────────────►  Web Service
    │                                    │
    │                                    │ 6. Update job (status: queued)
    │                                    │    Add job to Redis queue
    │                                    │    Deduct credit
    │                                    ▼
    │                              Database + Redis
    │
    │ 7. Return success
    ◄───────────────────────────┤
```

### 2. Video Processing Flow

```
Worker Service (Background)
    │
    │ 1. Pull job from Redis queue
    ├────────────────────────►  Redis
    │                                │
    │ 2. Get job details             │
    ├────────────────────────►  Database
    │                                │
    │ 3. Download input video        │
    ├────────────────────────►  Cloudflare R2
    │                                │
    │ 4. Process video locally       │
    │    - Detect silence (FFmpeg)
    │    - Remove silence
    │    - Stitch segments
    │
    │ 5. Upload output video         │
    ├────────────────────────►  Cloudflare R2
    │                                │
    │ 6. Update job status           │
    │    (status: completed)         │
    │    Save output file key        │
    ├────────────────────────►  Database
    │                                │
    │ 7. Send completion email       │
    └────────────────────────►  Resend API
```

### 3. Payment Flow

```
User Browser
    │
    │ 1. Request checkout
    ├───────────────────────────►  Web Service
    │                                    │
    │                                    │ 2. Create Stripe session
    │                                    ├──────────►  Stripe API
    │                                    │
    │ 3. Redirect to Stripe              │
    ◄───────────────────────────┤        │
    │                                    │
    │ 4. Complete payment               │
    ├──────────────────────────►  Stripe
    │                                    │
    │                                    │ 5. Webhook: payment_intent.succeeded
    │                                    ├──────────►  Web Service
    │                                                       │
    │                                                       │ 6. Add credits
    │                                                       ├──────►  Database
    │                                                       │
    │ 7. Redirect back                                      │
    ◄───────────────────────────────────────────────────────┤
```

## Component Details

### Web Service (Next.js)

**Purpose**: Handle HTTP requests, serve UI, manage API

**Responsibilities**:
- Serve web pages (landing, dashboard, auth)
- Handle authentication (NextAuth + Google OAuth)
- Process API requests (tRPC)
- Generate R2 presigned URLs
- Add jobs to Redis queue
- Handle Stripe webhooks
- Manage user sessions

**Technology**:
- Next.js 14 (App Router)
- React 18
- tRPC for type-safe APIs
- NextAuth for authentication
- Tailwind CSS for styling

**Runs on**: Railway Web Service
**Start command**: `npm run start`
**Port**: Auto-detected (usually 3000)

### Worker Service (FFmpeg)

**Purpose**: Process videos in the background

**Responsibilities**:
- Listen to Redis queue for jobs
- Download videos from R2
- Run FFmpeg to detect and remove silence
- Upload processed videos to R2
- Update job status in database
- Send email notifications

**Technology**:
- Node.js 20
- BullMQ for job processing
- FFmpeg for video manipulation
- IORedis for queue connection
- Drizzle ORM for database

**Runs on**: Railway Worker Service
**Start command**: `npm run start:worker`
**Port**: None (no HTTP server)

**Important**: 
- Can run multiple instances for parallel processing
- Each instance connects to the same Redis queue
- Jobs are distributed automatically by BullMQ

### PostgreSQL Database

**Purpose**: Store all application data

**Tables**:
- `users` - User accounts
- `workspaces` - Multi-tenant workspaces
- `workspace_memberships` - User-workspace relationships
- `video_jobs` - Video processing jobs
- `payments` - Payment records

**Hosted on**: Railway PostgreSQL
**Accessed by**: Web Service + Worker Service

### Redis Queue

**Purpose**: Job queue for background processing

**Queues**:
- `video-processing` - Video processing jobs

**Features**:
- Job persistence (survives worker restarts)
- Automatic retry on failure
- Job prioritization
- Rate limiting

**Hosted on**: Railway Redis
**Accessed by**: Web Service (producer) + Worker Service (consumer)

### Cloudflare R2

**Purpose**: Store video files

**Buckets**:
- Input videos: `input/<jobId>_<filename>`
- Output videos: `output/<jobId>_processed.mp4`

**Access**:
- Upload: Presigned URLs from web service
- Download: Direct URLs or presigned URLs
- Worker: SDK for upload/download

**Configuration**:
- CORS enabled for browser uploads
- Public read access for downloads

### External Services

#### Google OAuth
- **Purpose**: User authentication
- **Used by**: Web service
- **Config**: Redirect URI must match deployment URL

#### Stripe
- **Purpose**: Payment processing
- **Used by**: Web service
- **Config**: Webhook endpoint must be publicly accessible

#### Resend
- **Purpose**: Transactional emails
- **Used by**: Worker service
- **Emails**: Job completion, job failure notifications

## Scaling Strategy

### Horizontal Scaling

**Web Service**:
```
User ──► Load Balancer ──┬──► Web Instance 1
                         ├──► Web Instance 2
                         └──► Web Instance 3
```

All instances:
- Share the same database
- Share the same Redis
- Are stateless (no local state)

**Worker Service**:
```
Redis Queue ──┬──► Worker 1 (processing job A)
              ├──► Worker 2 (processing job B)
              └──► Worker 3 (idle, waiting)
```

All workers:
- Pull from the same queue
- Don't interfere with each other
- Can have different concurrency settings

### Vertical Scaling

**Web Service**:
- Increase memory for more concurrent requests
- Increase CPU for faster response times

**Worker Service**:
- Increase memory for larger videos
- Increase CPU for faster FFmpeg processing
- Increase concurrency for more parallel jobs

## Network Architecture

```
Internet
    │
    ├─────► Railway Load Balancer
    │           │
    │           ├─────► Web Service (HTTPS)
    │           │
    │           └─────► Metrics/Logs
    │
    ├─────► Cloudflare R2 (Videos)
    │
    ├─────► Stripe API (Payments)
    │
    └─────► Google OAuth (Authentication)

Internal Network (Railway)
    │
    ├─────► PostgreSQL (Private)
    │
    └─────► Redis (Private)
```

**Security**:
- PostgreSQL and Redis are NOT exposed to internet
- Only accessible within Railway project
- Connection strings use internal DNS
- TLS encryption for all connections

## Environment Configuration

### Shared Variables (Both Services)

```env
DATABASE_URL=postgresql://...     # From Railway PostgreSQL
REDIS_URL=redis://...            # From Railway Redis
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=https://...
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@...
NEXT_PUBLIC_APP_URL=https://...
```

### Web Service Only

```env
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

### Worker Service Only

No worker-specific variables needed. It uses the shared variables.

## Monitoring Points

### Application Metrics

1. **Web Service**
   - Request latency
   - Error rate
   - Active sessions
   - API endpoint usage

2. **Worker Service**
   - Jobs processed per hour
   - Average processing time
   - Failure rate
   - Queue depth

3. **Database**
   - Connection pool usage
   - Query performance
   - Storage size
   - Active connections

4. **Redis**
   - Queue length
   - Memory usage
   - Connection count
   - Job throughput

### Health Checks

**Web Service**:
```bash
curl https://your-app.railway.app/api/health
```

**Worker Service**:
- Monitor logs for "Video processing worker started"
- Check Redis queue for stuck jobs
- Monitor database for failed jobs

**Database**:
```sql
SELECT COUNT(*) FROM pg_stat_activity;
```

**Redis**:
```bash
redis-cli -u $REDIS_URL ping
```

## Deployment Flow

```
Developer
    │
    │ 1. Push code to GitHub
    ├─────────────────────►  GitHub
    │                            │
    │                            │ 2. Webhook to Railway
    │                            ├─────────────────────►  Railway
    │                                                        │
    │                                                        │ 3. Build & Deploy
    │                                                        ├──► Web Service
    │                                                        │
    │                                                        └──► Worker Service
    │
    │ 4. Deployment complete (both services updated)
    ◄────────────────────────────────────────────────────────┤
```

**Deployment Strategy**:
- Both services deploy from the same repo
- Different start commands determine service type
- Zero-downtime deployment (Railway handles)
- Rollback available if needed

## Failure Scenarios

### Web Service Crashes

**Impact**: Users can't access website
**Mitigation**: Railway auto-restarts
**Recovery**: Usually < 30 seconds

### Worker Service Crashes

**Impact**: Videos stuck in "queued" status
**Mitigation**: 
- Railway auto-restarts worker
- Jobs persist in Redis
- Worker resumes processing after restart
**Recovery**: Jobs continue from queue

### Database Crashes

**Impact**: Everything stops
**Mitigation**: Railway handles backups
**Recovery**: Railway restores from backup

### Redis Crashes

**Impact**: 
- Can't queue new jobs
- Processing jobs continue
**Mitigation**: Railway auto-restarts Redis
**Recovery**: 
- Queued jobs are lost (Redis is in-memory)
- Users can re-submit videos

### R2 Outage

**Impact**: 
- Can't upload/download videos
- Processing fails
**Mitigation**: Jobs marked as failed
**Recovery**: Users can retry after R2 is back

## Summary

✅ **Multi-service architecture** for scalability
✅ **Decoupled processing** for reliability
✅ **Managed infrastructure** via Railway
✅ **Horizontal scaling** for both web and worker
✅ **Automatic failover** and restarts
✅ **Clear separation** of concerns

The architecture is production-ready and can scale from 1 to 1000s of users! 🚀

