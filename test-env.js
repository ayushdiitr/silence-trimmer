// Test if environment variables are loaded
console.log("Testing environment variable loading...\n");

console.log("DATABASE_URL:", process.env.DATABASE_URL ? "✅ Set" : "❌ Not set");
console.log("REDIS_URL:", process.env.REDIS_URL ? "✅ Set" : "❌ Not set");
console.log("R2_ACCOUNT_ID:", process.env.R2_ACCOUNT_ID ? "✅ Set" : "❌ Not set");
console.log("NEXTAUTH_SECRET:", process.env.NEXTAUTH_SECRET ? "✅ Set" : "❌ Not set");

console.log("\nAll env vars keys:", Object.keys(process.env).filter(k => !k.startsWith("npm_")).slice(0, 10));

