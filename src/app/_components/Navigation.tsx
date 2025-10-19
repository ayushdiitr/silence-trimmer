"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { api } from "~/trpc/react";
import { signOut } from "next-auth/react";

export function Navigation() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { data: workspace } = api.workspace.getById.useQuery(
    {},
    {
      retry: false,
      refetchOnWindowFocus: false,
      enabled: !!session && typeof window !== "undefined", // Only fetch workspace if user is logged in and on client
    },
  );

  // Don't render during SSR
  if (typeof window === "undefined") {
    return null;
  }

  // Don't show nav on auth pages or landing page
  if (pathname?.startsWith("/auth") || pathname === "/") {
    return null;
  }

  // Don't show nav if user is not logged in
  if (status === "unauthenticated") {
    return null;
  }

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <nav className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="h-8 w-32 animate-pulse rounded bg-gray-200"></div>
            <div className="flex items-center gap-6">
              <div className="h-4 w-20 animate-pulse rounded bg-gray-200"></div>
              <div className="h-4 w-20 animate-pulse rounded bg-gray-200"></div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  const primaryColor = workspace?.primaryColor ?? "#7c3aed";
  const logoUrl = workspace?.logoUrl;
  const workspaceName = workspace?.name ?? "Video Processor";

  return (
    <nav className="border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={workspaceName} className="h-8 w-auto" />
            ) : (
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg font-bold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                V
              </div>
            )}
            <span className="text-xl font-bold text-gray-900">
              {workspaceName}
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className={`text-sm font-medium transition ${
                pathname === "/dashboard"
                  ? "text-gray-900"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/settings"
              className={`text-sm font-medium transition ${
                pathname === "/settings"
                  ? "text-gray-900"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Settings
            </Link>

            {/* User Info & Sign Out */}
            <div className="flex items-center gap-4 border-l border-gray-200 pl-6">
              {session?.user && (
                <div className="flex items-center gap-3">
                  {session.user.image && (
                    <img
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      className="h-8 w-8 rounded-full"
                    />
                  )}
                  <div className="flex flex-col">
                    {session.user.name && (
                      <span className="text-sm font-medium text-gray-900">
                        {session.user.name}
                      </span>
                    )}
                    {session.user.email && (
                      <span className="text-xs text-gray-500">
                        {session.user.email}
                      </span>
                    )}
                  </div>
                </div>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                className="text-sm font-medium text-gray-600 transition hover:text-gray-900"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inject custom color as CSS variable */}
      <style jsx global>{`
        :root {
          --workspace-primary-color: ${primaryColor};
        }
      `}</style>
    </nav>
  );
}
