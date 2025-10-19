# Worker Environment Debug Guide

## Current Setup

I've configured the worker to use `tsx -r dotenv/config` which should load `.env` before any code runs.

## Files Changed

1. **`package.json`** - Updated dev:worker script:
   ```json
   "dev:worker": "tsx -r dotenv/config watch src/worker/index.ts"
   ```

2. **`src/worker/env.ts`** - Simplified (dotenv loaded by tsx):
   ```typescript
   import { env } from "~/env";
   export const workerEnv = env;
   ```

3. **`src/worker/index.ts`** - Uses `workerEnv` instead of `env`

## Debugging Steps

### Step 1: Test dotenv Loading

Run this test to verify dotenv works:

```bash
node -r dotenv/config test-env.js
```

If this shows "✅ Set" for all variables, dotenv is working.

### Step 2: Check Your .env File

Make sure `.env` has NO syntax errors:

```bash
# Check for common issues
cat .env | grep "="

# Common mistakes:
# ❌ DATABASE_URL = "postgres://..."  (spaces around =)
# ❌ DATABASE_URL='postgres://...'     (single quotes)
# ✅ DATABASE_URL="postgres://..."     (double quotes, no spaces)
# ✅ DATABASE_URL=postgres://...       (no quotes, no spaces)
```

### Step 3: Try Different Approaches

If `tsx -r dotenv/config` doesn't work, try these alternatives:

#### Option A: Load dotenv in worker file directly

**Update `src/worker/env.ts`:**
```typescript
// Load dotenv FIRST
import dotenv from "dotenv";
dotenv.config();

// Then import main env
import { env } from "~/env";
export const workerEnv = env;
```

**Update `package.json`:**
```json
"dev:worker": "tsx watch src/worker/index.ts"
```

#### Option B: Use NODE_OPTIONS

**Update `package.json`:**
```json
"dev:worker": "NODE_OPTIONS='--require dotenv/config' tsx watch src/worker/index.ts"
```

#### Option C: Create a wrapper script

**Create `scripts/start-worker.js`:**
```javascript
// Load environment first
require('dotenv').config();

// Then start the worker
require('../dist/worker/index.js');
```

**Update `package.json`:**
```json
"dev:worker": "tsx --loader tsx/esm scripts/worker-loader.ts"
```

### Step 4: Check tsx Version

Make sure you have a recent version of tsx:

```bash
npm list tsx
# Should be 4.x or higher
```

If it's old:
```bash
npm install tsx@latest --save-dev
```

### Step 5: Verify Environment in Worker

Add debug logging at the start of `src/worker/index.ts`:

```typescript
// At the very top, after imports
console.log("🔍 Debug - Environment check:");
console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);
console.log("REDIS_URL exists:", !!process.env.REDIS_URL);
console.log("R2_ACCOUNT_ID exists:", !!process.env.R2_ACCOUNT_ID);
```

This will help identify if dotenv is loading but validation is failing.

## Common Issues & Solutions

### Issue 1: "Invalid environment variables" - All undefined

**Cause**: `.env` file not being loaded
**Solution**: 
- Check `.env` is in project root (same directory as `package.json`)
- Try Option A above (load dotenv directly in file)

### Issue 2: "Invalid environment variables" - Some undefined

**Cause**: Missing variables in `.env` file
**Solution**: Compare `.env` with `.env.example`:

```bash
# See what's in .env.example
cat .env.example

# Make sure your .env has all these variables
```

### Issue 3: "Invalid type, expected string, received undefined"

**Cause**: Variable exists but is empty string
**Solution**: Check `.env` for empty values:

```bash
# Look for lines like: SOME_VAR=
# or SOME_VAR=""
cat .env | grep "=$"
```

All variables must have values.

### Issue 4: tsx command not found

**Cause**: tsx not installed
**Solution**:
```bash
npm install
# or
npm install tsx --save-dev
```

## Manual Testing

### Test 1: Can you load env vars manually?

Create `test-manual.ts`:
```typescript
import dotenv from "dotenv";
dotenv.config();

console.log("DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 20) + "...");
console.log("REDIS_URL:", process.env.REDIS_URL);
```

Run:
```bash
tsx test-manual.ts
```

### Test 2: Does @t3-oss/env-nextjs work with loaded vars?

Create `test-validation.ts`:
```typescript
import dotenv from "dotenv";
dotenv.config();

// Should work now
import { env } from "./src/env";

console.log("✅ Environment validation passed!");
console.log("DATABASE_URL loaded:", !!env.DATABASE_URL);
```

Run:
```bash
tsx test-validation.ts
```

## The Root Cause

The issue is the **order of operations**:

```
❌ Wrong Order:
1. tsx starts
2. import { env } from "~/env"
3. @t3-oss/env-nextjs validates
4. process.env is empty
5. Validation fails

✅ Correct Order:
1. tsx starts with -r dotenv/config
2. dotenv loads .env
3. process.env gets populated
4. import { env } from "~/env"
5. @t3-oss/env-nextjs validates
6. Validation succeeds
```

## Recommended Solution

Based on the errors you're seeing, I recommend **Option A** (load dotenv directly in file):

1. **Edit `src/worker/env.ts`:**
```typescript
import dotenv from "dotenv";
dotenv.config();

import { env } from "~/env";
export const workerEnv = env;
```

2. **Edit `package.json`:**
```json
"dev:worker": "tsx watch src/worker/index.ts"
```

3. **Run:**
```bash
npm run dev:worker
```

This is the most reliable approach because it guarantees dotenv runs before any validation.

## Still Not Working?

If none of these work, there might be an issue with the `.env` file format. Create a minimal test:

1. **Create `test-minimal.ts`:**
```typescript
import dotenv from "dotenv";
const result = dotenv.config();

if (result.error) {
  console.error("❌ Error loading .env:", result.error);
} else {
  console.log("✅ .env loaded successfully");
  console.log("Parsed variables:", Object.keys(result.parsed || {}).length);
}

console.log("\nChecking specific variables:");
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Present" : "Missing");
console.log("REDIS_URL:", process.env.REDIS_URL ? "Present" : "Missing");
```

2. **Run:**
```bash
tsx test-minimal.ts
```

This will tell you if dotenv can read your `.env` file at all.

## Quick Fix Summary

**Try this RIGHT NOW:**

1. Edit `src/worker/env.ts`:
```typescript
import dotenv from "dotenv";
dotenv.config();
import { env } from "~/env";
export const workerEnv = env;
```

2. Run:
```bash
npm run dev:worker
```

If you still get errors, copy the EXACT error message and we'll debug further.

