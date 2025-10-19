import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { workspaces } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export default async function Home() {
  const session = await auth();

  // If logged in, redirect to dashboard
  if (session) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Redirecting to dashboard...</p>
          <script dangerouslySetInnerHTML={{ __html: "window.location.href='/dashboard'" }} />
        </div>
      </main>
    );
  }

  // Check if this is a custom domain
  const headersList = await headers();
  const customDomain = headersList.get("x-custom-domain");
  
  // Get workspace branding if custom domain
  let workspace = null;
  if (customDomain) {
    const workspaceResults = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.customDomain, customDomain))
      .limit(1);
    workspace = workspaceResults[0] ?? null;
  }

  // Use workspace branding or defaults
  const brandName = workspace?.name ?? "Video Processor";
  const brandColor = workspace?.primaryColor ?? "#7c3aed";
  const brandLogo = workspace?.logoUrl;

  // Convert hex color to RGB for gradients
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1]!, 16),
          g: parseInt(result[2]!, 16),
          b: parseInt(result[3]!, 16),
        }
      : { r: 124, g: 58, b: 237 }; // Default purple
  };

  const rgb = hexToRgb(brandColor);
  const gradientFrom = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  const gradientTo = `rgb(${Math.max(0, rgb.r - 50)}, ${Math.max(0, rgb.g - 50)}, ${Math.max(0, rgb.b - 50)})`;

  return (
    <main 
      className="min-h-screen bg-gradient-to-b"
      style={{
        backgroundImage: `linear-gradient(to bottom, ${gradientFrom}, ${gradientTo})`,
      }}
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Logo/Brand */}
        {brandLogo && (
          <div className="mb-12 flex justify-center">
            <img src={brandLogo} alt={brandName} className="h-16 w-auto" />
          </div>
        )}

        {/* Hero Section */}
        <div className="text-center">
          <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
            {workspace ? (
              <>
                {brandName}
                <span className="block text-white/80">Video Processing</span>
              </>
            ) : (
              <>
                Remove Silence from Videos
                <span className="block text-purple-200">Automatically</span>
              </>
            )}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl text-white/90">
            Upload your video, and we&apos;ll automatically detect and remove all silent
            parts, then stitch it back together. Perfect for content creators,
            educators, and professionals.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/auth/signin"
              className="rounded-lg bg-white px-8 py-4 text-lg font-semibold shadow-xl transition hover:bg-white/90"
              style={{ color: brandColor }}
            >
              Get Started Free
            </Link>
            <Link
              href="#features"
              className="rounded-lg border-2 border-white px-8 py-4 text-lg font-semibold text-white transition hover:bg-white/10"
            >
              Learn More
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div id="features" className="mt-32">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="rounded-xl bg-white/10 p-8 backdrop-blur">
              <div 
                className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg"
                style={{ backgroundColor: brandColor }}
              >
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">
                Lightning Fast
              </h3>
              <p className="mt-2 text-white/80">
                Process videos quickly with our optimized FFmpeg pipeline. Get your
                edited video in minutes.
              </p>
            </div>

            <div className="rounded-xl bg-white/10 p-8 backdrop-blur">
              <div 
                className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg"
                style={{ backgroundColor: brandColor }}
              >
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">
                Smart Detection
              </h3>
              <p className="mt-2 text-white/80">
                Advanced silence detection removes awkward pauses while preserving
                your content&apos;s flow.
              </p>
            </div>

            <div className="rounded-xl bg-white/10 p-8 backdrop-blur">
              <div 
                className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg"
                style={{ backgroundColor: brandColor }}
              >
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">
                Secure & Private
              </h3>
              <p className="mt-2 text-white/80">
                Your videos are processed securely and deleted after download. We
                respect your privacy.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-32 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready to save hours of editing time?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/90">
            Get 1 free credit when you sign up. No credit card required.
          </p>
          <div className="mt-8">
            <Link
              href="/auth/signin"
              className="inline-block rounded-lg bg-white px-8 py-4 text-lg font-semibold shadow-xl transition hover:bg-white/90"
              style={{ color: brandColor }}
            >
              Start Processing Videos
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
