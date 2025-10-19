# Quick Reference Card

## 🚀 Common Commands

### Development
```bash
npm run dev              # Start Next.js dev server (port 3000)
npm run dev:worker       # Start video processing worker
npm run db:studio        # Open Drizzle Studio GUI
```

### Build & Production
```bash
npm run build            # Build Next.js app
npm run build:worker     # Build worker service
npm run start            # Start production server
npm run start:worker     # Start production worker
```

### Database
```bash
npm run db:push          # Push schema changes to database
npm run db:generate      # Generate migration files
```

### Code Quality
```bash
npm run lint             # Run ESLint
npm run lint:fix         # Fix linting issues
npm run format:write     # Format code with Prettier
npm run typecheck        # Run TypeScript type checking
```

## 📁 Important File Locations

### Configuration
- Environment: `.env`
- Database: `src/server/db/schema.ts`
- Auth: `src/server/auth.ts`
- tRPC: `src/server/api/trpc.ts`

### API Routes
- Video: `src/server/api/routers/video.ts`
- Workspace: `src/server/api/routers/workspace.ts`
- Payment: `src/server/api/routers/payment.ts`

### Frontend Pages
- Landing: `src/app/page.tsx`
- Dashboard: `src/app/dashboard/page.tsx`
- Settings: `src/app/settings/page.tsx`
- Job Detail: `src/app/dashboard/jobs/[id]/page.tsx`

### Worker
- Processing: `src/worker/index.ts`

## 🔑 Environment Variables Quick List

```bash
# Required
DATABASE_URL=
REDIS_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=
RESEND_API_KEY=
EMAIL_FROM=
NEXT_PUBLIC_APP_URL=
```

## 🌐 Local URLs

- **App**: http://localhost:3000
- **Drizzle Studio**: http://local.drizzle.studio
- **API**: http://localhost:3000/api/trpc

## 🐛 Quick Troubleshooting

### Port 3000 in use
```bash
lsof -i :3000
kill -9 <PID>
```

### Database connection error
```bash
pg_isready
createdb video_processor
```

### Redis connection error
```bash
redis-cli ping
brew services restart redis  # macOS
```

### Clear node_modules
```bash
rm -rf node_modules package-lock.json
npm install
```

### Reset database
```bash
npm run db:push
```

## 📊 Database Tables

- `users` - User accounts
- `workspaces` - Workspace data & white-label config
- `memberships` - User-workspace relationships
- `videoJobs` - Video processing jobs
- `payments` - Stripe payment records

## 🎯 tRPC API Endpoints

### Video
- `video.createUploadUrl` - Get presigned upload URL
- `video.confirmUpload` - Start processing
- `video.getJobs` - List jobs
- `video.getJobStatus` - Get job details
- `video.getCredits` - Get credits

### Workspace
- `workspace.getMyWorkspaces` - List workspaces
- `workspace.getById` - Get workspace
- `workspace.update` - Update settings
- `workspace.create` - Create workspace

### Payment
- `payment.createCheckoutSession` - Create Stripe checkout

## 🚢 Deployment Quick Steps

1. Push code to GitHub
2. Create Railway project
3. Add PostgreSQL + Redis
4. Add Web service (from GitHub)
5. Add Worker service (from GitHub)
6. Set environment variables
7. Deploy!

## 📧 Webhook URLs

### Stripe (Production)
```
https://yourdomain.com/api/webhooks/stripe
```

### Stripe (Local Testing)
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## 🔐 OAuth Callback URLs

### Google (Production)
```
https://yourdomain.com/api/auth/callback/google
```

### Google (Local)
```
http://localhost:3000/api/auth/callback/google
```

## 📦 Key Dependencies

- **next** - Framework
- **react** - UI library
- **@trpc/server** - API
- **drizzle-orm** - Database ORM
- **next-auth** - Authentication
- **stripe** - Payments
- **bullmq** - Job queue
- **@aws-sdk/client-s3** - R2 storage
- **resend** - Email

## 🎨 White-Label Settings

Located in Settings page:
- **Logo URL** - Image URL for logo
- **Primary Color** - Hex color (#rrggbb)
- **Custom Domain** - Your custom domain

## 💳 Test Stripe Card

```
Card: 4242 4242 4242 4242
Expiry: Any future date
CVC: Any 3 digits
ZIP: Any 5 digits
```

## 📝 Useful SQL Queries

```sql
-- Check users
SELECT * FROM assignment_user;

-- Check workspaces
SELECT * FROM assignment_workspace;

-- Check jobs
SELECT * FROM assignment_video_job ORDER BY created_at DESC;

-- Check credits
SELECT name, credits FROM assignment_workspace;
```

## 🔍 Redis Commands

```bash
# Connect
redis-cli

# Check queue
KEYS bull:video-processing:*

# Monitor activity
MONITOR
```

## 📚 Documentation Links

- Setup Guide: `SETUP.md`
- Deployment Guide: `RAILWAY_DEPLOYMENT.md`
- Implementation Details: `IMPLEMENTATION_SUMMARY.md`
- Main README: `README.md`

## ⚡ Quick Testing Flow

1. Sign up → Google OAuth
2. Dashboard → Upload video
3. Wait for processing
4. Download processed video
5. Settings → Change theme
6. Buy credits → Stripe test

## 🛠 Common Tasks

### Add new tRPC endpoint
1. Add to router in `src/server/api/routers/`
2. Export from `src/server/api/root.ts`
3. Use in frontend with `api.router.procedure.useQuery()`

### Add new page
1. Create in `src/app/your-page/page.tsx`
2. Add navigation link in `src/app/_components/Navigation.tsx`

### Modify database
1. Update `src/server/db/schema.ts`
2. Run `npm run db:push`

### Add environment variable
1. Add to `.env`
2. Add validation to `src/env.js`
3. Restart dev server

## 🎯 Performance Tips

- Direct R2 uploads (no server bandwidth)
- Presigned URLs for downloads
- Indexed database queries
- React Query caching
- Worker concurrency tuning

## 🔒 Security Checklist

- [x] Authentication required
- [x] Workspace isolation
- [x] Private file storage
- [x] Webhook signature verification
- [x] Input validation
- [x] SQL injection prevention (Drizzle)
- [x] XSS prevention (React)

## 💡 Tips

- Use Drizzle Studio for database inspection
- Check Railway logs for debugging
- Stripe CLI for local webhook testing
- Redis monitor for queue debugging
- Browser DevTools for frontend issues

---

**Need more help?** Check the full documentation in README.md

