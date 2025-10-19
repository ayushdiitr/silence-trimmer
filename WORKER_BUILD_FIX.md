# Worker Build Fix

## Problem

When building the worker with `npm run build:worker`, you got TypeScript errors:

```
src/server/api/root.ts:1:31 - error TS2307: Cannot find module '~/server/api/routers/payment' or its corresponding type declarations.
```

## Root Cause

The `tsconfig.worker.json` was including `src/server/**/*`, which included:
- `src/server/api/` - tRPC routers (Next.js specific)
- `src/server/auth.ts` - NextAuth configuration (Next.js specific)

These files have dependencies on Next.js modules that aren't available in the worker context and aren't needed for the worker.

## Solution

Updated `tsconfig.worker.json` to only include the server utilities the worker actually needs:

### Before (❌):
```json
{
  "include": ["src/worker/**/*", "src/server/**/*", "src/env.js"],
  "exclude": ["node_modules", "src/app/**/*", "src/trpc/**/*"]
}
```

This included ALL server files, including API routers and auth.

### After (✅):
```json
{
  "include": [
    "src/worker/**/*",
    "src/server/db/**/*",
    "src/server/storage/**/*",
    "src/server/email/**/*",
    "src/server/queue/**/*",
    "src/env.js"
  ],
  "exclude": [
    "node_modules",
    "src/app/**/*",
    "src/trpc/**/*",
    "src/server/api/**/*",
    "src/server/auth.ts"
  ]
}
```

Now only includes what the worker needs:
- ✅ `src/worker/**/*` - Worker code
- ✅ `src/server/db/**/*` - Database connection and schema
- ✅ `src/server/storage/**/*` - R2/S3 storage utilities
- ✅ `src/server/email/**/*` - Email sending utilities
- ✅ `src/server/queue/**/*` - BullMQ queue utilities
- ✅ `src/env.js` - Environment variables

And explicitly excludes:
- ❌ `src/server/api/**/*` - tRPC routers (not needed)
- ❌ `src/server/auth.ts` - NextAuth (not needed)

## What the Worker Needs

The worker is a standalone Node.js process that:
1. Connects to Redis (BullMQ)
2. Processes video jobs
3. Reads/writes to R2 storage
4. Updates database records
5. Sends email notifications

It does NOT need:
- tRPC routers
- NextAuth
- React/Next.js
- API routes

## Testing the Fix

```bash
# Build the worker
npm run build:worker

# Should complete without errors
# Output: dist/worker/index.js
```

Expected output:
```
> assignment@0.1.0 build:worker
> tsc --project tsconfig.worker.json

✓ Built successfully
```

## Worker File Structure

After building, you should have:

```
dist/
  worker/
    index.js          # Main worker entry point
    env.js            # Environment loader
    server/
      db/
        index.js      # Database connection
        schema.js     # Database schema
      storage/
        r2.js         # R2 utilities
      email/
        index.js      # Email utilities
      queue/
        index.js      # Queue utilities
```

## Running the Worker

### Development:
```bash
npm run dev:worker
```

Uses `tsx` to run TypeScript directly without building.

### Production:
```bash
# Build first
npm run build:worker

# Then run
npm run start:worker
```

Uses the compiled JavaScript from `dist/worker/`.

## Why Separate Configs?

### Main App (`tsconfig.json`):
- Includes everything: app, server, worker
- Used for development and type checking
- Next.js handles the build

### Worker (`tsconfig.worker.json`):
- Only includes worker and its dependencies
- Compiles to plain Node.js JavaScript
- No Next.js dependencies

This separation ensures:
1. ✅ Clean builds without unnecessary files
2. ✅ No Next.js dependencies in worker
3. ✅ Faster builds (less to compile)
4. ✅ Smaller output (only what's needed)

## Troubleshooting

### Error: Cannot find module '~/server/api/...'

**Cause**: Worker is trying to import API routers
**Solution**: Check `tsconfig.worker.json` excludes `src/server/api/**/*`

### Error: Cannot find module 'next/...'

**Cause**: Worker is importing Next.js-specific code
**Solution**: Check what's being imported in worker, remove Next.js dependencies

### Error: Module not found after build

**Cause**: Missing file in includes
**Solution**: Add the required directory to `include` array in `tsconfig.worker.json`

## Best Practices

### Keep Worker Isolated

The worker should be a standalone process:
- ✅ Use database directly
- ✅ Use storage directly
- ✅ Use email directly
- ❌ Don't import from `src/app/`
- ❌ Don't import from `src/server/api/`
- ❌ Don't import Next.js modules

### Shared Code

Code that both worker and app need should go in:
- `src/server/db/` - Database
- `src/server/storage/` - File storage
- `src/server/email/` - Emails
- `src/server/queue/` - Job queue

Code that only the app needs should go in:
- `src/server/api/` - tRPC routers
- `src/server/auth.ts` - NextAuth
- `src/app/` - React components

### Environment Variables

Both app and worker use `src/env.js`, but:
- Worker loads it via `src/worker/env.ts` (with dotenv)
- App loads it directly (Next.js handles dotenv)

## Summary

✅ **Fixed**: `tsconfig.worker.json` to only include necessary files
✅ **Excluded**: API routers and NextAuth from worker build
✅ **Result**: Worker builds without errors
✅ **Benefit**: Smaller, cleaner worker build

The worker can now be built and deployed independently of the main Next.js app! 🎉

