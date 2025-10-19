import { TRPCError } from "@trpc/server";
import Stripe from "stripe";
import { z } from "zod";

import { env } from "~/env";
import { createTRPCRouter, workspaceProcedure } from "~/server/api/trpc";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
});

export const paymentRouter = createTRPCRouter({
  /**
   * Create a Stripe Checkout session for purchasing credits
   */
  createCheckoutSession: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx }) => {
      try {
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          payment_method_types: ["card"],
          line_items: [
            {
              price: env.STRIPE_PRICE_ID,
              quantity: 1,
            },
          ],
          success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard?payment=success`,
          cancel_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard?payment=cancelled`,
          metadata: {
            workspaceId: ctx.workspace.id,
            userId: ctx.session.user.id,
          },
          client_reference_id: ctx.workspace.id,
          payment_intent_data: {
            metadata: {
              workspaceId: ctx.workspace.id,
              userId: ctx.session.user.id,
            },
          },
        });

        if (!session.url) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create checkout session",
          });
        }

        return {
          url: session.url,
          sessionId: session.id,
        };
      } catch (error) {
        console.error("Stripe checkout error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create checkout session",
        });
      }
    }),
});

