/**
 * Script to manually add credits for a completed payment that wasn't processed
 *
 * Usage:
 *   npx tsx scripts/fix-missing-credits.ts <workspaceId> <stripeSessionId> <amount>
 *
 * Example:
 *   npx tsx scripts/fix-missing-credits.ts abc123 pi_1234567890 1000
 */

import { eq } from "drizzle-orm";
import { db } from "../src/server/db";
import { payments, workspaces } from "../src/server/db/schema";

async function addMissingCredits() {
  const workspaceId = process.argv[2];
  const stripeSessionId = process.argv[3];
  const amount = parseInt(process.argv[4] ?? "1000");

  if (!workspaceId || !stripeSessionId) {
    console.error(
      "❌ Usage: npx tsx scripts/fix-missing-credits.ts <workspaceId> <stripeSessionId> [amount]",
    );
    console.error(
      "\nExample: npx tsx scripts/fix-missing-credits.ts abc123 pi_1234567890 1000",
    );
    process.exit(1);
  }

  try {
    // Check if workspace exists
    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (workspace.length === 0) {
      console.error(`❌ Workspace not found: ${workspaceId}`);
      process.exit(1);
    }

    console.log(`\n📊 Current workspace credits: ${workspace[0]!.credits}`);

    // Check if payment already exists
    const existingPayment = await db
      .select()
      .from(payments)
      .where(eq(payments.stripeSessionId, stripeSessionId))
      .limit(1);

    if (existingPayment.length > 0) {
      console.log(`⚠️  Payment already recorded: ${stripeSessionId}`);
      console.log(`   Status: ${existingPayment[0]!.status}`);
      console.log(`   Credits added: ${existingPayment[0]!.creditsAdded}`);

      const proceed = process.argv.includes("--force");
      if (!proceed) {
        console.log("\n💡 Use --force flag to add credits anyway");
        process.exit(0);
      }
    }

    // Add 100 credits
    const creditsToAdd = 100;
    const newCredits = workspace[0]!.credits + creditsToAdd;

    await db
      .update(workspaces)
      .set({ credits: newCredits })
      .where(eq(workspaces.id, workspaceId));

    // Create payment record
    await db.insert(payments).values({
      workspaceId,
      stripeSessionId,
      amount,
      creditsAdded: creditsToAdd,
      status: "completed",
    });

    console.log(`\n✅ Successfully added ${creditsToAdd} credits!`);
    console.log(`   Previous credits: ${workspace[0]!.credits}`);
    console.log(`   New credits: ${newCredits}`);
    console.log(`   Payment record created: ${stripeSessionId}`);
  } catch (error) {
    console.error("\n❌ Error adding credits:", error);
    process.exit(1);
  }

  process.exit(0);
}

addMissingCredits();
