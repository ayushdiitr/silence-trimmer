import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { env } from "~/env";
import { db } from "~/server/db";
import { payments, workspaces } from "~/server/db/schema";

export const runtime = "nodejs";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 },
    );
  }

  // Log all received events for debugging
  console.log(`Received Stripe webhook event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const workspaceId =
          session.metadata?.workspaceId ?? session.client_reference_id;

        if (!workspaceId) {
          console.error("No workspace ID in session metadata");
          return NextResponse.json(
            { error: "No workspace ID" },
            { status: 400 },
          );
        }

        // Add credits to workspace
        const creditsToAdd = 100;
        const currentWorkspace = await db
          .select()
          .from(workspaces)
          .where(eq(workspaces.id, workspaceId))
          .limit(1);

        if (currentWorkspace.length > 0) {
          await db
            .update(workspaces)
            .set({
              credits: currentWorkspace[0]!.credits + creditsToAdd,
            })
            .where(eq(workspaces.id, workspaceId));
        }

        // Create payment record
        await db.insert(payments).values({
          workspaceId,
          stripeSessionId: session.id,
          amount: session.amount_total ?? 0,
          creditsAdded: creditsToAdd,
          status: "completed",
        });

        console.log(
          `Added ${creditsToAdd} credits to workspace ${workspaceId}`,
        );
        break;
      }

      case "payment_intent.succeeded": {
        // Backup handler for when checkout.session.completed is not received
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        // Get the checkout session from the payment intent
        if (paymentIntent.metadata?.workspaceId) {
          const workspaceId = paymentIntent.metadata.workspaceId;

          // Check if we already processed this payment
          const existingPayment = await db
            .select()
            .from(payments)
            .where(eq(payments.stripeSessionId, paymentIntent.id))
            .limit(1);

          if (existingPayment.length === 0) {
            // Add credits to workspace
            const creditsToAdd = 100;
            const currentWorkspace = await db
              .select()
              .from(workspaces)
              .where(eq(workspaces.id, workspaceId))
              .limit(1);

            if (currentWorkspace.length > 0) {
              await db
                .update(workspaces)
                .set({
                  credits: currentWorkspace[0]!.credits + creditsToAdd,
                })
                .where(eq(workspaces.id, workspaceId));

              // Create payment record
              await db.insert(payments).values({
                workspaceId,
                stripeSessionId: paymentIntent.id,
                amount: paymentIntent.amount,
                creditsAdded: creditsToAdd,
                status: "completed",
              });

              console.log(
                `[payment_intent.succeeded] Added ${creditsToAdd} credits to workspace ${workspaceId}`,
              );
            }
          } else {
            console.log(
              `[payment_intent.succeeded] Payment already processed: ${paymentIntent.id}`,
            );
          }
        } else {
          console.log(
            `[payment_intent.succeeded] No workspace ID in payment intent metadata`,
          );
        }
        break;
      }

      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const workspaceId =
          session.metadata?.workspaceId ?? session.client_reference_id;

        if (workspaceId) {
          // Create failed payment record
          await db.insert(payments).values({
            workspaceId,
            stripeSessionId: session.id,
            amount: session.amount_total ?? 0,
            creditsAdded: 0,
            status: "failed",
          });
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
