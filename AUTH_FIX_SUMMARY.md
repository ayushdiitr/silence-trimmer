# Authentication Edge Runtime Fix

## Problem

You encountered this error when logging in with Google OAuth:

```
[auth][error] JWTSessionError: Read more at https://errors.authjs.dev#jwtsessionerror
[auth][cause]: Error: The edge runtime does not support Node.js 'net' module.
```

## Root Cause

The issue occurred because:

1. **Middleware runs on Edge Runtime** - Next.js middleware runs on the Edge Runtime by default, which has limited Node.js API support
2. **Database access in session callback** - The original `session` callback was trying to query the database to fetch the user ID on every request
3. **Postgres driver needs 'net' module** - The Postgres connection library requires Node.js's `net` module, which is not available in Edge Runtime

## Solution

I made the following changes to fix this issue:

### 1. Changed to JWT Session Strategy (`src/server/auth.ts`)

```typescript
session: {
  strategy: "jwt",
}
```

This tells NextAuth to use JWT tokens instead of database sessions, which is compatible with Edge Runtime.

### 2. Moved User ID Fetching to JWT Callback

**Before (❌):**
```typescript
async session({ session }) {
  if (session.user?.email) {
    const dbUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1);
    // This runs on every request in middleware!
  }
  return session;
}
```

**After (✅):**
```typescript
async jwt({ token, user }) {
  // Only runs during sign-in, not on every request
  if (user && user.email) {
    const dbUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, user.email))
      .limit(1);
    
    if (dbUsers.length > 0) {
      token.id = dbUsers[0]!.id;
    }
  }
  return token;
},
async session({ session, token }) {
  // Just reads from the token, no database call
  if (token.id && typeof token.id === "string") {
    session.user.id = token.id;
  }
  return session;
}
```

### 3. Explicitly Set Node.js Runtime for Auth Routes (`src/app/api/auth/[...nextauth]/route.ts`)

```typescript
export const runtime = "nodejs";
```

This ensures the auth callback route (where database writes happen during sign-in) uses the full Node.js runtime.

## How It Works Now

1. **Sign In Flow** (uses Node.js runtime):
   - User signs in with Google
   - `signIn` callback creates/updates user in database
   - `jwt` callback fetches user ID and stores it in the JWT token
   - Token is encrypted and sent to client as a cookie

2. **Subsequent Requests** (works in Edge Runtime):
   - Middleware reads the JWT token from cookie
   - No database calls needed - user ID comes from the token
   - Custom domain header is set if needed
   - Request continues to your app

3. **Session Access**:
   - `session.user.id` is available throughout your app
   - Comes from the JWT token, not the database
   - Fast and Edge Runtime compatible

## Benefits

- ✅ **Edge Runtime Compatible** - No database calls in middleware
- ✅ **Better Performance** - No DB query on every request
- ✅ **Maintains Functionality** - User ID still available in session
- ✅ **Secure** - JWT tokens are encrypted with NEXTAUTH_SECRET
- ✅ **Works with Middleware** - Custom domain detection continues to work

## Testing

After this fix, you should be able to:
1. Sign in with Google successfully
2. Access protected routes
3. Use custom domains
4. See your user ID in the session object

## Important Notes

- **JWT Tokens are Stateless** - User information is cached in the token until it expires
- **Token Expiration** - If you update user data in the database, it won't reflect in the session until the token refreshes (default: 30 days)
- **If You Need Real-Time User Data** - Query the database in your tRPC procedures or API routes (not in middleware)

## Related Files Changed

1. `src/server/auth.ts` - Added JWT strategy and moved logic to JWT callback
2. `src/app/api/auth/[...nextauth]/route.ts` - Set runtime to "nodejs"
3. `src/middleware.ts` - Minor type adjustment (no functional change)

