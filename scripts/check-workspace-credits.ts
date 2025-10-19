/**
 * Script to check workspace credits and recent payments
 * 
 * Usage:
 *   npx tsx scripts/check-workspace-credits.ts [email or workspaceId]
 * 
 * Example:
 *   npx tsx scripts/check-workspace-credits.ts ayush@example.com
 *   npx tsx scripts/check-workspace-credits.ts abc123
 */

import { eq, desc } from "drizzle-orm";
import { db } from "../src/server/db";
import { users, workspaces, memberships, payments } from "../src/server/db/schema";

async function checkCredits() {
  const identifier = process.argv[2];

  if (!identifier) {
    console.error("❌ Usage: npx tsx scripts/check-workspace-credits.ts <email or workspaceId>");
    console.error("\nExample: npx tsx scripts/check-workspace-credits.ts ayush@example.com");
    process.exit(1);
  }

  try {
    let workspaceList: any[] = [];

    // Check if identifier is an email
    if (identifier.includes("@")) {
      // Find user by email
      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, identifier))
        .limit(1);

      if (user.length === 0) {
        console.error(`❌ User not found: ${identifier}`);
        process.exit(1);
      }

      console.log(`\n👤 User: ${user[0]!.name} (${user[0]!.email})`);
      console.log(`   ID: ${user[0]!.id}`);

      // Get user's workspaces
      const userMemberships = await db
        .select({
          workspace: workspaces,
          role: memberships.role,
        })
        .from(memberships)
        .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
        .where(eq(memberships.userId, user[0]!.id));

      workspaceList = userMemberships.map(m => ({ ...m.workspace, role: m.role }));
    } else {
      // Treat as workspace ID
      const workspace = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, identifier))
        .limit(1);

      if (workspace.length === 0) {
        console.error(`❌ Workspace not found: ${identifier}`);
        process.exit(1);
      }

      workspaceList = workspace;
    }

    if (workspaceList.length === 0) {
      console.log("\n⚠️  No workspaces found");
      process.exit(0);
    }

    // Display workspace information
    console.log(`\n📊 Workspace${workspaceList.length > 1 ? 's' : ''}:\n`);

    for (const workspace of workspaceList) {
      console.log(`   Name: ${workspace.name}`);
      console.log(`   ID: ${workspace.id}`);
      console.log(`   Slug: ${workspace.slug}`);
      console.log(`   Credits: ${workspace.credits}`);
      if ('role' in workspace) {
        console.log(`   Your Role: ${workspace.role}`);
      }
      
      // Get recent payments for this workspace
      const recentPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.workspaceId, workspace.id))
        .orderBy(desc(payments.createdAt))
        .limit(5);

      if (recentPayments.length > 0) {
        console.log(`\n   💳 Recent Payments:`);
        for (const payment of recentPayments) {
          console.log(`      - ${payment.status}: +${payment.creditsAdded} credits ($${(payment.amount / 100).toFixed(2)})`);
          console.log(`        Session: ${payment.stripeSessionId}`);
          console.log(`        Date: ${payment.createdAt.toISOString()}`);
        }
      } else {
        console.log(`\n   💳 No payment history`);
      }

      console.log("");
    }

  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

checkCredits();

