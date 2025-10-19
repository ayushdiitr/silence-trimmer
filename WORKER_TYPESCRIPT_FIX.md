# Worker TypeScript Configuration Fix

## Problem

When running the worker with `npm run dev:worker`, TypeScript compilation errors occurred:

```
error TS2351: This expression is not constructable.
  Type 'typeof import("ioredis")' has no construct signatures.
```

This happened because the worker's `tsconfig.worker.json` was using `NodeNext` module resolution, which has strict requirements for how CommonJS and ESM modules are imported.

## Root Cause

The worker uses a mix of:
- **ESM packages** (modern packages with `"type": "module"`)
- **CommonJS packages** (older packages like `ioredis`)
- **Path aliases** (`~/server/...`)
- **TypeScript imports** with mixed module types

With `NodeNext` module resolution:
- Default imports from CommonJS require `.default`
- Named imports have strict type checking
- Module interop is limited

## Solution

Changed `tsconfig.worker.json` to use `Bundler` module resolution:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "./dist/worker",
    "rootDir": "./src",
    "noEmit": false,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  },
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
    "dist"
  ]
}
```

### Key Changes

1. **`module: "ESNext"`** - Use modern ES modules
2. **`moduleResolution: "Bundler"`** - Use bundler-style resolution (like tsx, esbuild, webpack)
3. **`esModuleInterop: true`** - Allow default imports from CommonJS
4. **`allowSyntheticDefaultImports: true`** - Allow synthetic default imports

## Why This Works

### Bundler Module Resolution

The `Bundler` module resolution strategy:
- ✅ Handles CommonJS and ESM seamlessly
- ✅ Allows default imports from CommonJS (`import Redis from "ioredis"`)
- ✅ Resolves path aliases correctly
- ✅ Works with `tsx`, `esbuild`, `webpack`, etc.
- ✅ No need for `.default` workarounds

### ESNext Module

Using `ESNext` as the module target:
- ✅ Preserves `import`/`export` statements
- ✅ Works with `tsx` runtime
- ✅ No transpilation to CommonJS
- ✅ Modern JavaScript features

### ESM Interop

`esModuleInterop` and `allowSyntheticDefaultImports`:
- ✅ Allow `import Redis from "ioredis"` instead of `import * as Redis from "ioredis"`
- ✅ Make CommonJS modules work like ESM
- ✅ Better developer experience

## Deployment Strategy

Since we're using `tsx` for both development and production, we don't need a build step:

### Development
```bash
npm run dev:worker
# Uses: tsx -r dotenv/config src/worker/index.ts
```

### Production
```bash
npm run start:worker
# Uses: NODE_ENV=production tsx -r dotenv/config src/worker/index.ts
```

### Why No Build?

**Pros of using tsx directly:**
- ✅ No build step needed
- ✅ Simpler deployment
- ✅ Path aliases work automatically
- ✅ Hot reload in development
- ✅ No module resolution issues

**Cons:**
- ⚠️ Requires TypeScript in production
- ⚠️ Slightly slower startup (JIT compilation)
- ⚠️ Larger deployment size

**For this project, the pros outweigh the cons because:**
1. Worker is not latency-sensitive (startup time doesn't matter)
2. Simplicity is more important than optimization
3. Easier to debug and maintain
4. No complex bundler configuration needed

## Alternative Solutions (Not Used)

### Option 1: Fix Imports for NodeNext

Change all imports to use `.default`:
```typescript
import RedisModule from "ioredis";
const Redis = RedisModule.default;
```

**Why not:** Ugly, error-prone, hard to maintain

### Option 2: Use esbuild/webpack

Bundle the worker with esbuild:
```bash
esbuild src/worker/index.ts --bundle --platform=node --outfile=dist/worker.js
```

**Why not:** Adds complexity, requires bundler configuration

### Option 3: Convert to CommonJS

Change everything to `require()`:
```typescript
const Redis = require("ioredis");
```

**Why not:** Loses ESM benefits, path aliases don't work

### Option 4: Use ts-node

Replace tsx with ts-node:
```bash
ts-node -r dotenv/config src/worker/index.ts
```

**Why not:** tsx is faster and more modern

## Files Changed

1. **`tsconfig.worker.json`**
   - Changed `module` to `ESNext`
   - Changed `moduleResolution` to `Bundler`
   - Added `esModuleInterop` and `allowSyntheticDefaultImports`

2. **`package.json`**
   - Updated `build:worker` to skip build
   - Updated `start:worker` to use tsx with dotenv

3. **`WORKER_DEPLOYMENT.md`** (new)
   - Complete deployment guide
   - Multiple deployment options
   - Monitoring and troubleshooting

## Verification

To verify the fix works:

```bash
# Start worker
npm run dev:worker

# Should see:
# Video processing worker started
# Connected to Redis: redis://localhost:6379
# Temp directory: /tmp/video-processor
```

No TypeScript errors should appear.

## Summary

✅ **Fixed** - Changed module resolution to `Bundler`
✅ **Simplified** - No build step needed
✅ **Works** - CommonJS and ESM imports work seamlessly
✅ **Documented** - Complete deployment guide created

The worker is now ready for development and production! 🎉

