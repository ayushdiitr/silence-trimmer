import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // Force Node.js runtime instead of Edge

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") ?? "";

  // Get the main app URL domain
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "";
  const mainDomain = appUrl.replace(/^https?:\/\//, "").split(":")[0];

  // Check if this is a custom domain (not the main domain)
  const isCustomDomain =
    !host.includes(mainDomain ?? "") && !host.includes("localhost");

  // Clone the request headers
  const requestHeaders = new Headers(req.headers);

  // Store custom domain info in headers for tRPC context
  if (isCustomDomain) {
    requestHeaders.set("x-custom-domain", host.split(":")[0]!);
  }

  // Pass through with updated headers
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
