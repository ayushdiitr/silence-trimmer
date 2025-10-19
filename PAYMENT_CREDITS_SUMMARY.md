# Payment Credits Issue - Summary & Solution

## ✅ What I Fixed

Your payment completed successfully but credits weren't being added because:

**Problem**: Your webhook was only listening for `checkout.session.completed`, but Stripe was sending:
- `payment_intent.created`
- `payment_intent.succeeded` ✅
- `charge.succeeded`

**Solution**: Added a `payment_intent.succeeded` handler as a backup to ensure credits are added.

## 📝 Files Changed

### 1. `src/app/api/webhooks/stripe/route.ts`
- ✅ Added `export const runtime = "nodejs"`
- ✅ Added logging for all webhook events
- ✅ Added `payment_intent.succeeded` event handler
- ✅ Added duplicate payment protection

### 2. `src/server/api/routers/payment.ts`
- ✅ Added `payment_intent_data.metadata` to pass workspace info to payment intent

### 3. Created Helper Scripts

**`scripts/check-workspace-credits.ts`** - Check your current credits and payment history
```bash
npx tsx scripts/check-workspace-credits.ts your-email@example.com
```

**`scripts/fix-missing-credits.ts`** - Manually add credits for the payment that failed
```bash
npx tsx scripts/fix-missing-credits.ts <workspaceId> <stripeSessionId> <amount>
```

## 🚀 Quick Fix for Your Current Situation

### Step 1: Check Your Current Workspace

```bash
npx tsx scripts/check-workspace-credits.ts your-email@example.com
```

This will show:
- Your workspace ID
- Current credits
- Payment history

### Step 2: Find Your Stripe Payment Intent ID

Look in your Stripe Dashboard or your application logs for the recent payment. The payment intent ID looks like: `pi_xxxxxxxxxxxxx`

### Step 3: Manually Add the Missing Credits

```bash
npx tsx scripts/fix-missing-credits.ts <your-workspace-id> <payment-intent-id> 1000
```

Example:
```bash
npx tsx scripts/fix-missing-credits.ts abc123def456 pi_3ABCdefGHIjkl 1000
```

This will:
- Add 100 credits to your workspace
- Create a payment record
- Show before/after credit counts

## 🔄 For Future Payments

**Option A: Restart your dev server** (if testing locally)
```bash
npm run dev
```

Now all future payments will work automatically because the webhook now handles `payment_intent.succeeded` events.

**Option B: Configure Stripe webhook to send `checkout.session.completed`**

1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Click on your webhook endpoint
3. Click "Add events"
4. Enable: `checkout.session.completed`
5. Save

## 🧪 Test a New Payment

1. Make another test payment using card: `4242 4242 4242 4242`
2. Check your server logs - you should see:
   ```
   Received Stripe webhook event: payment_intent.succeeded
   [payment_intent.succeeded] Added 100 credits to workspace abc123
   ```
3. Verify credits were added in your dashboard

## 📊 Monitoring

### Check Server Logs
When payments are processed, you should see:
```
Received Stripe webhook event: payment_intent.created
Received Stripe webhook event: payment_intent.succeeded
[payment_intent.succeeded] Added 100 credits to workspace <id>
```

### Check Stripe Dashboard
Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks) to see:
- Which events are being sent
- Response status (should be 200)
- Any errors

### Verify in Database
```bash
npx tsx scripts/check-workspace-credits.ts your-email@example.com
```

## ⚠️ Important Notes

1. **Restart Required**: Restart your dev server for webhook changes to take effect
2. **Metadata Required**: New checkout sessions will include workspace metadata in payment intent
3. **Duplicate Protection**: The webhook won't add credits twice for the same payment
4. **Credits Amount**: Currently set to 100 credits per payment (1000 cents = $10)

## 🛠️ Troubleshooting

### Credits still not updating after new payment?

1. **Check logs**: Look for "Received Stripe webhook event" messages
2. **Check metadata**: Look for "No workspace ID in payment intent metadata" error
3. **Verify webhook**: Ensure your webhook endpoint is receiving events in Stripe Dashboard

### "No workspace ID in payment intent metadata"?

- This means you're testing with an old checkout session
- Create a NEW checkout session (restart server first)
- The new session will include the metadata

### Webhook signature verification failed?

- Check your `STRIPE_WEBHOOK_SECRET` in `.env`
- For Stripe CLI: Use the secret from `stripe listen` output
- For production: Use the secret from Stripe Dashboard

## 📖 Full Documentation

See `STRIPE_WEBHOOK_FIX.md` for complete details on:
- How the fix works
- Stripe webhook configuration
- Testing procedures
- Production deployment

