#!/usr/bin/env tsx

/**
 * Check for pending custom domains that need to be added to Railway
 * 
 * Usage: npm run domains:pending
 */

import { db } from "~/server/db";
import { workspaces } from "~/server/db/schema";
import { isNotNull, sql } from "drizzle-orm";

const BASE_DOMAIN = process.env.BASE_DOMAIN || process.env.NEXT_PUBLIC_BASE_DOMAIN || "yourdomain.com";

async function checkPendingDomains() {
  console.log("🔍 Checking for pending custom domains...\n");

  // Get all workspaces with custom domains
  const allWorkspaces = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      customDomain: workspaces.customDomain,
      createdAt: workspaces.createdAt,
    })
    .from(workspaces)
    .where(isNotNull(workspaces.customDomain))
    .orderBy(sql`${workspaces.createdAt} DESC`);

  if (allWorkspaces.length === 0) {
    console.log("✅ No custom domains configured yet.\n");
    return;
  }

  // Separate subdomains from custom domains
  const subdomains = allWorkspaces.filter(w => 
    w.customDomain?.endsWith(`.${BASE_DOMAIN}`)
  );

  const customDomains = allWorkspaces.filter(w => 
    !w.customDomain?.endsWith(`.${BASE_DOMAIN}`)
  );

  console.log("📊 Summary:");
  console.log(`   Total domains: ${allWorkspaces.length}`);
  console.log(`   Subdomains (*.${BASE_DOMAIN}): ${subdomains.length}`);
  console.log(`   Custom domains (BYOD): ${customDomains.length}\n`);

  if (subdomains.length > 0) {
    console.log(`✅ Subdomains (automatic SSL via wildcard):`);
    console.log(`   These should work automatically if *.${BASE_DOMAIN} is configured in Railway\n`);
    
    subdomains.forEach((ws, idx) => {
      console.log(`   ${idx + 1}. ${ws.customDomain}`);
      console.log(`      Workspace: ${ws.name} (${ws.slug})`);
      console.log(`      Created: ${ws.createdAt.toLocaleDateString()}`);
      console.log(`      Status: ✅ Automatic SSL`);
      console.log(``);
    });
  }

  if (customDomains.length > 0) {
    console.log(`⚠️  Custom Domains (require manual Railway addition):`);
    console.log(`   These need to be added to Railway for SSL to work\n`);
    
    customDomains.forEach((ws, idx) => {
      console.log(`   ${idx + 1}. ${ws.customDomain}`);
      console.log(`      Workspace: ${ws.name} (${ws.slug})`);
      console.log(`      Created: ${ws.createdAt.toLocaleDateString()}`);
      console.log(`      Action needed: Add to Railway Dashboard → Domains`);
      console.log(`      URL: https://railway.app/project/your-project/service/web/settings`);
      console.log(``);
    });

    console.log(`\n📋 Steps to activate custom domains:`);
    console.log(`   1. Go to Railway Dashboard`);
    console.log(`   2. Select your Web Service → Settings → Networking → Domains`);
    console.log(`   3. Click "+ Custom Domain"`);
    console.log(`   4. Enter each domain above`);
    console.log(`   5. Railway will provision SSL (5-15 minutes)\n`);
  }

  console.log(`\n💡 Tips:`);
  console.log(`   - Wildcard subdomain (*.${BASE_DOMAIN}) is configured once in Railway`);
  console.log(`   - Custom domains must be added individually to Railway`);
  console.log(`   - Consider Cloudflare proxy for unlimited custom domains\n`);

  console.log(`📚 Documentation:`);
  console.log(`   - SSL Setup: RAILWAY_SSL_SETUP.md`);
  console.log(`   - Wildcard Guide: WILDCARD_SETUP_GUIDE.md`);
  console.log(`   - BYOD Guide: BRING_YOUR_OWN_DOMAIN.md\n`);
}

checkPendingDomains()
  .then(() => {
    console.log("✅ Done!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });

