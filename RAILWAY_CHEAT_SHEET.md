# Railway Deployment Cheat Sheet

Quick reference for deploying the video processor on Railway.

## 🚀 Quick Deploy (5 Steps)

### 1️⃣ Connect Repo
```
Railway Dashboard → New Project → Deploy from GitHub → Select Repo
```

### 2️⃣ Add Databases
```
+ New → Database → PostgreSQL
+ New → Database → Redis
```

### 3️⃣ Configure Web Service
```
Settings → Start Command: npm run start
Variables → Add all environment variables
```

### 4️⃣ Create Worker Service
```
+ New → GitHub Repo → Same Repo
Settings → Start Command: npm run start:worker
Variables → Copy from web service
```

### 5️⃣ Deploy & Test
```
Check logs → Upload test video → Verify processing
```

## 📝 Required Environment Variables

```env
# Auto-provided by Railway
DATABASE_URL=<from-postgresql-service>
REDIS_URL=<from-redis-service>

# You must add these:
NEXTAUTH_SECRET=<generate-random-string>
NEXTAUTH_URL=<your-railway-url>
GOOGLE_CLIENT_ID=<from-google-console>
GOOGLE_CLIENT_SECRET=<from-google-console>
R2_ACCOUNT_ID=<from-cloudflare>
R2_ACCESS_KEY_ID=<from-cloudflare>
R2_SECRET_ACCESS_KEY=<from-cloudflare>
R2_BUCKET_NAME=<your-bucket-name>
R2_PUBLIC_URL=https://<bucket>.r2.dev
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com
NEXT_PUBLIC_APP_URL=<your-railway-url>
```

## 🔧 Common Commands

### Local Development
```bash
npm run dev              # Start web server
npm run dev:worker       # Start worker
npm run db:push          # Push schema to database
npm run db:studio        # Open Drizzle Studio
```

### Production (Railway)
```bash
# Web service start command:
npm run start

# Worker service start command:
npm run start:worker
```

## 🐛 Quick Troubleshooting

| Issue | Quick Fix |
|-------|-----------|
| FFmpeg not found | Add `nixpacks.worker.toml`, see [RAILWAY_FFMPEG_FIX.md](./RAILWAY_FFMPEG_FIX.md) |
| Worker not starting | Check start command is `npm run start:worker` |
| Jobs stuck in queue | Verify `REDIS_URL` same in both services |
| Upload fails | Check R2 credentials and CORS config |
| Credits not added | Verify Stripe webhook URL and secret |
| No emails | Check Resend API key and domain |

## 📊 Service Architecture

```
┌─────────────────────────────────────┐
│        Your Railway Project         │
├─────────────────────────────────────┤
│                                     │
│  Web Service    Worker Service      │
│  ↓                ↓                 │
│  ├─→ PostgreSQL ←─┤                 │
│  └─→ Redis      ←─┘                 │
│                                     │
└─────────────────────────────────────┘
```

## ✅ Deployment Checklist

- [ ] Railway project created
- [ ] PostgreSQL added
- [ ] Redis added
- [ ] Web service deployed
- [ ] Worker service deployed
- [ ] All env vars set in both services
- [ ] Google OAuth configured
- [ ] Stripe webhook configured
- [ ] Test video upload works
- [ ] Email notifications work
- [ ] Custom domain configured (optional)

## 🔗 Quick Links

- [Railway Dashboard](https://railway.app)
- [Full Deployment Guide](./RAILWAY_DEPLOYMENT.md)
- [Worker Setup Guide](./RAILWAY_WORKER_QUICK_START.md)
- [Architecture Diagram](./ARCHITECTURE.md)
- [Troubleshooting](./RAILWAY_WORKER_SETUP.md#troubleshooting)

## 💡 Pro Tips

1. **Copy ALL env vars to worker** - Extra variables won't hurt
2. **Check logs first** - Most issues show clear error messages
3. **Test locally first** - Run `npm run dev:worker` before deploying
4. **Monitor queue length** - Use `redis-cli LLEN bull:video-processing:wait`
5. **Scale workers independently** - Add more workers for faster processing

## 📞 Need Help?

1. Check the error in logs
2. Search this doc for the error
3. Check [RAILWAY_WORKER_SETUP.md](./RAILWAY_WORKER_SETUP.md) for detailed troubleshooting
4. Ask in Railway Discord

---

**Last updated:** After TypeScript configuration fix
**Config files:** `tsconfig.worker.json`, `railway.worker.json`, `package.json`

