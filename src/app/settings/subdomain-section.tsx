"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";

interface SubdomainSectionProps {
  workspaceId: string;
  currentDomain?: string | null;
}

export function SubdomainSection({ workspaceId, currentDomain }: SubdomainSectionProps) {
  const [subdomain, setSubdomain] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [availability, setAvailability] = useState<{
    available: boolean;
    domain: string;
    reason?: string;
  } | null>(null);

  const utils = api.useUtils();
  const reserveSubdomain = api.workspace.reserveSubdomain.useMutation();
  const checkAvailability = api.workspace.checkSubdomainAvailability.useQuery(
    { subdomain },
    { 
      enabled: subdomain.length >= 3,
      retry: false,
    }
  );
  const removeDomain = api.workspace.removeDomain.useMutation();

  // Update availability when check completes
  useEffect(() => {
    if (checkAvailability.data) {
      setAvailability(checkAvailability.data);
    }
  }, [checkAvailability.data]);

  const handleReserveSubdomain = async () => {
    if (!subdomain || !availability?.available) return;

    try {
      const result = await reserveSubdomain.mutateAsync({ subdomain, workspaceId });
      utils.workspace.getById.invalidate();
      toast.success(result.message, {
        description: `Your site is now live at ${result.url}`,
        duration: 5000,
        action: {
          label: "Visit",
          onClick: () => window.open(result.url, "_blank"),
        },
      });
      setSubdomain("");
      setAvailability(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reserve subdomain"
      );
    }
  };

  const handleRemoveDomain = async () => {
    if (!confirm("Are you sure you want to remove your custom domain?")) {
      return;
    }

    try {
      await removeDomain.mutateAsync({ workspaceId });
      utils.workspace.getById.invalidate();
      toast.success("Custom domain removed successfully!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove domain"
      );
    }
  };

  const handleSubdomainChange = (value: string) => {
    // Only allow lowercase letters, numbers, and hyphens
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSubdomain(cleaned);
  };

  const getAvailabilityMessage = () => {
    if (!availability) return null;

    if (availability.reason === "reserved") {
      return (
        <p className="text-sm text-red-600">
          ✗ This subdomain is reserved for system use
        </p>
      );
    }

    if (availability.reason === "taken") {
      return (
        <p className="text-sm text-red-600">
          ✗ Already taken - try another subdomain
        </p>
      );
    }

    if (availability.available) {
      return (
        <p className="text-sm text-green-600">
          ✓ Available! Your site will be at: {availability.domain}
        </p>
      );
    }

    return null;
  };

  if (currentDomain) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="flex items-center gap-2 font-medium text-green-900">
              <svg
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Custom Domain Active
            </p>
            <a
              href={`https://${currentDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-green-700 underline hover:text-green-800"
            >
              {currentDomain}
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
          <button
            onClick={handleRemoveDomain}
            disabled={removeDomain.isPending}
            className="rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-200 disabled:opacity-50"
          >
            {removeDomain.isPending ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-sm text-blue-800">
          💡 Reserve a subdomain to give your workspace a custom branded URL.
          
        </p>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <input
            type="text"
            value={subdomain}
            onChange={(e) => handleSubdomainChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
            placeholder="yourcompany"
            minLength={3}
            maxLength={63}
          />
        </div>
        <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
          <span className="text-gray-600">.{process.env.NEXT_PUBLIC_BASE_DOMAIN || "yourdomain.com"}</span>
        </div>
      </div>

      {subdomain && subdomain.length >= 3 && (
        <div className="min-h-[24px]">
          {checkAvailability.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Checking availability...
            </p>
          ) : (
            getAvailabilityMessage()
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleReserveSubdomain}
        disabled={
          !subdomain ||
          subdomain.length < 3 ||
          !availability?.available ||
          reserveSubdomain.isPending ||
          checkAvailability.isLoading
        }
        className="w-full rounded-lg bg-purple-600 px-4 py-3 font-medium text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {reserveSubdomain.isPending
          ? "Activating..."
          : "Reserve Subdomain (Instant)"}
      </button>

      {/* <p className="text-xs text-gray-500">
        Your subdomain will be instantly active with SSL certificate. No DNS
        configuration required!
      </p> */}
    </div>
  );
}

