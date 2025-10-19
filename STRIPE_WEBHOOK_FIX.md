# Stripe Webhook Fix - Credits Not Updating

## Problem

After completing a payment, credits were not being added to your workspace. The webhook was receiving:
- ✅ `payment_intent.created`
- ✅ `payment_intent.succeeded`
- ✅ `charge.succeeded`

But **NOT** receiving:
- ❌ `checkout.session.completed` (the event your code was listening for)

## Root Cause

The webhook handler was only listening for `checkout.session.completed`, but that event wasn't being sent to your webhook endpoint. This could happen if:

1. **Webhook Configuration** - The Stripe webhook isn't configured to send `checkout.session.completed` events
2. **Event Selection** - You need to explicitly enable this event in Stripe Dashboard

## Solution

I've made the following changes:

### 1. Added `payment_intent.succeeded` Handler (`src/app/api/webhooks/stripe/route.ts`)

Now the webhook handles BOTH events:
- `checkout.session.completed` (primary)
- `payment_intent.succeeded` (backup)

This ensures credits are added regardless of which event Stripe sends.

### 2. Pass Metadata to Payment Intent (`src/server/api/routers/payment.ts`)

Added `payment_intent_data` to the checkout session creation:

```typescript
payment_intent_data: {
  metadata: {
    workspaceId: ctx.workspace.id,
    userId: ctx.session.user.id,
  },
}
```

This ensures the workspace ID is available in the `payment_intent.succeeded` event.

### 3. Added Duplicate Payment Protection

The webhook now checks if a payment was already processed to prevent duplicate credit additions.

### 4. Added Logging

All webhook events are now logged so you can see what events are being received.

### 5. Set Node.js Runtime

Added `export const runtime = "nodejs"` to ensure the webhook route uses the full Node.js runtime (not Edge Runtime).

## How to Fix Your Stripe Webhook Configuration

### Option 1: Using Stripe Dashboard (Production)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Find your webhook endpoint
3. Click "Add events" or edit the webhook
4. Make sure these events are enabled:
   - ✅ `checkout.session.completed`
   - ✅ `checkout.session.expired`
   - ✅ `checkout.session.async_payment_failed`
   - ✅ `payment_intent.succeeded` (backup)

### Option 2: Using Stripe CLI (Development)

If you're testing locally with Stripe CLI:

```bash
# Forward all checkout and payment events
stripe listen --forward-to localhost:3000/api/webhooks/stripe \
  --events checkout.session.completed,checkout.session.expired,checkout.session.async_payment_failed,payment_intent.succeeded
```

Or forward ALL events (easier for development):

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## Testing the Fix

### 1. Restart Your Dev Server

```bash
npm run dev
```

### 2. Check Current Credits

Before testing, note your current credit count in the dashboard.

### 3. Make a Test Payment

Use Stripe test card:
- Card number: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits

### 4. Check Your Server Logs

You should see logs like:

```
Received Stripe webhook event: payment_intent.created
Received Stripe webhook event: payment_intent.succeeded
[payment_intent.succeeded] Added 100 credits to workspace abc123
```

Or if `checkout.session.completed` is configured:

```
Received Stripe webhook event: checkout.session.completed
Added 100 credits to workspace abc123
```

### 5. Verify Credits Were Added

Check your dashboard - you should see 100 credits added.

## Manually Fix Previous Failed Payments

If you already made a payment that didn't add credits, you can either:

### Option 1: Resend the Webhook from Stripe Dashboard

1. Go to [Stripe Dashboard > Events](https://dashboard.stripe.com/events)
2. Find the recent `payment_intent.succeeded` or `checkout.session.completed` event
3. Click on it
4. Click "Resend webhook" at the top right
5. Select your webhook endpoint

### Option 2: Manually Add Credits via Database

If you have database access, you can manually update credits:

```sql
-- Add 100 credits to a workspace
UPDATE assignment_workspace 
SET credits = credits + 100 
WHERE id = 'your-workspace-id';

-- Create a payment record
INSERT INTO assignment_payment (id, "workspaceId", "stripeSessionId", amount, "creditsAdded", status, "createdAt")
VALUES (
  gen_random_uuid(),
  'your-workspace-id',
  'your-stripe-session-id',
  1000, -- amount in cents
  100,
  'completed',
  NOW()
);
```

## Changes Made to Files

1. **`src/app/api/webhooks/stripe/route.ts`**
   - ✅ Added `export const runtime = "nodejs"`
   - ✅ Added logging for all webhook events
   - ✅ Added `payment_intent.succeeded` handler
   - ✅ Added duplicate payment protection

2. **`src/server/api/routers/payment.ts`**
   - ✅ Added `payment_intent_data.metadata` to pass workspace info

## Important Notes

### Event Priority

1. **`checkout.session.completed`** (Preferred)
   - Fires when the checkout session is complete
   - Contains full session information
   - Best for production use

2. **`payment_intent.succeeded`** (Backup)
   - Fires when payment succeeds
   - Good fallback option
   - Now includes metadata

### Webhook Security

- Webhooks are verified using `STRIPE_WEBHOOK_SECRET`
- Make sure your `.env` has the correct webhook secret
- For Stripe CLI, use the secret from `stripe listen` output
- For production, use the secret from Stripe Dashboard

### Credits Amount

Currently set to **100 credits per payment**. You can change this in the webhook handler:

```typescript
const creditsToAdd = 100; // Change this value
```

## Troubleshooting

### "No workspace ID in payment intent metadata"

- Make sure you restart your server after updating the payment router
- New payments should include the metadata

### Webhook signature verification failed

- Check your `STRIPE_WEBHOOK_SECRET` in `.env`
- For CLI: Copy the webhook secret from `stripe listen` output
- For production: Copy from Stripe Dashboard webhook settings

### Credits still not updating

1. Check server logs for webhook events
2. Verify webhook is receiving events (check Stripe Dashboard > Webhooks > Recent deliveries)
3. Check for errors in the webhook response
4. Verify workspace ID is correct

## Next Steps

1. **Configure Stripe webhook** to include `checkout.session.completed` event
2. **Test a new payment** to verify credits are added
3. **Monitor logs** to see which events are being received
4. **Fix any previous failed payments** using the manual methods above

