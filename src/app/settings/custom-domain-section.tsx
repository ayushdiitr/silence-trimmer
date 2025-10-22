"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";

interface CustomDomainSectionProps {
  workspaceId: string;
  currentDomain: string | null;
  isSubdomain: boolean; // true if current domain is a subdomain on your platform
}

export function CustomDomainSection({
  workspaceId,
  currentDomain,
  isSubdomain,
}: CustomDomainSectionProps) {
  const [domain, setDomain] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [needsDnsConfig, setNeedsDnsConfig] = useState(false);
  const [railwayCnameValue, setRailwayCnameValue] = useState<string | null>(null);

  // Load cached DNS config state on component mount
  React.useEffect(() => {
    const cachedDnsConfig = localStorage.getItem(`dns-config-${workspaceId}`);
    if (cachedDnsConfig) {
      try {
        const { needsDnsConfig: cachedNeedsDnsConfig, railwayCnameValue: cachedCnameValue, timestamp } = JSON.parse(cachedDnsConfig);
        // Cache for 1 hour (3600000 ms)
        const isExpired = Date.now() - timestamp > 3600000;
        if (!isExpired && cachedNeedsDnsConfig && cachedCnameValue) {
          setNeedsDnsConfig(cachedNeedsDnsConfig);
          setRailwayCnameValue(cachedCnameValue);
        } else if (isExpired) {
          // Clear expired cache
          localStorage.removeItem(`dns-config-${workspaceId}`);
        }
      } catch (error) {
        console.error('Error parsing cached DNS config:', error);
        localStorage.removeItem(`dns-config-${workspaceId}`);
      }
    }
  }, [workspaceId]);

  // Cache DNS config state when it changes
  React.useEffect(() => {
    if (needsDnsConfig && railwayCnameValue) {
      const cacheData = {
        needsDnsConfig,
        railwayCnameValue,
        timestamp: Date.now()
      };
      localStorage.setItem(`dns-config-${workspaceId}`, JSON.stringify(cacheData));
    } else if (!needsDnsConfig) {
      // Clear cache when DNS is no longer needed
      localStorage.removeItem(`dns-config-${workspaceId}`);
    }
  }, [needsDnsConfig, railwayCnameValue, workspaceId]);

  const utils = api.useUtils();
  const verifyDomain = api.workspace.verifyDomain.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        // Domain is fully configured and working
        if (data.autoActivated && data.cnameValue) {
          toast.success("🎉 Domain activated automatically!", {
            description: `Railway CNAME: ${data.cnameValue}. SSL certificate will be provisioned in 5-15 minutes.`,
            duration: 10000,
          });
        } else if (data.autoActivated) {
          toast.success("🎉 Domain activated automatically!", {
            description:
              "Your domain has been added to Railway! SSL certificate will be provisioned in 5-15 minutes.",
            duration: 10000,
          });
        } else {
          toast.success("DNS verified!", {
            description: data.message,
            duration: 10000,
          });
        }
        setDomain("");
        setNeedsDnsConfig(false);
        setRailwayCnameValue(null);
      } else if (data.needsDnsConfig) {
        // Domain created in Railway but DNS needs configuration
        setNeedsDnsConfig(true);
        setRailwayCnameValue(data.cnameValue);
        toast.warning("Domain added to Railway! Configure DNS now", {
          description: data.message,
          duration: 15000,
        });
        // Don't clear the domain input so user can see what they need to configure
      } else {
        // Other success case
        toast.success("Domain processed", {
          description: data.message,
          duration: 10000,
        });
        setDomain("");
        setNeedsDnsConfig(false);
        setRailwayCnameValue(null);
      }
      utils.workspace.getById.invalidate();
      getDomainInstructions.refetch();
      domainStatus.refetch();
    },
    onError: (error) => {
      toast.error("Domain verification failed", {
        description: error.message,
        duration: 8000,
      });
    },
  });

  const removeDomain = api.workspace.removeDomain.useMutation({
    onSuccess: () => {
      toast.success("Custom domain removed");
      utils.workspace.getById.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to remove domain", {
        description: error.message,
      });
    },
  });

  const getDomainInstructions = api.workspace.getDomainInstructions.useQuery({
    workspaceId,
  });

  const domainStatus = api.workspace.checkDomainStatus.useQuery({
    workspaceId,
  });

  const handleVerify = async () => {
    if (!domain.trim()) {
      toast.error("Please enter a domain");
      return;
    }

    setIsVerifying(true);
    try {
      await verifyDomain.mutateAsync({
        domain: domain.trim(),
        workspaceId,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRemove = () => {
    if (
      !confirm(
        "Are you sure you want to remove this custom domain? Your workspace will no longer be accessible via this domain.",
      )
    ) {
      return;
    }

    // Clear DNS config cache when removing domain
    localStorage.removeItem(`dns-config-${workspaceId}`);
    setNeedsDnsConfig(false);
    setRailwayCnameValue(null);
    
    removeDomain.mutate({ workspaceId });
  };

  const cnameTarget = needsDnsConfig && railwayCnameValue 
    ? railwayCnameValue 
    : (getDomainInstructions.data?.cnameTarget || "your-app.up.railway.app");
  const subdomain = domain ? domain.split(".")[0] : "videos";

  // // Don't show this section if user has a subdomain - they should upgrade
  // if (currentDomain && isSubdomain) {
  //   return (
  //     <div className="rounded-lg border border-purple-200 bg-purple-50 p-6">
  //       <div className="mb-4 flex items-center justify-between">
  //         <h2 className="text-xl font-semibold text-purple-900">
  //           Custom Domain 
  //         </h2>
  //         <span className="rounded-full bg-purple-200 px-3 py-1 text-xs font-medium text-purple-800">
  //           Upgrade to Premium
  //         </span>
  //       </div>
  //       <p className="mb-4 text-sm text-purple-800">
  //         Want to use your own domain (e.g., <code>videos.yourcompany.com</code>)
  //         instead of a subdomain? Upgrade to Premium for full white-label
  //         branding!
  //       </p>
  //       <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-700">
  //         Upgrade to Premium ($50/mo)
  //       </button>
  //     </div>
  //   );
  // }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          Custom Domain 
        </h2>
        <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800">
          Bring Your Own Domain
        </span>
      </div>

      {currentDomain && !isSubdomain ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-green-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">
                  Active Custom Domain
                </p>
                <p className="mt-1 text-lg font-semibold text-green-900">
                  {currentDomain}
                </p>
                <a
                  href={`https://${currentDomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center text-sm text-green-700 hover:text-green-900"
                >
                  Visit your site
                  <svg
                    className="ml-1 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>
              <button
                onClick={handleRemove}
                disabled={removeDomain.isPending}
                className="rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-200 disabled:opacity-50"
              >
                {removeDomain.isPending ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>

         {needsDnsConfig && railwayCnameValue && (
            <div className="mb-4 rounded-lg border-2 border-orange-200 bg-orange-50 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-orange-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-orange-900">
                     DNS Configuration Required
                  </h3>
                  <p className="mt-1 text-sm text-orange-800">
                    Your domain has been added to Railway! Now configure your DNS to point to:
                  </p>
                  <div className="mt-3 rounded-lg bg-white p-3 border border-orange-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">CNAME Value:</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(railwayCnameValue);
                          toast.success("CNAME value copied to clipboard!");
                        }}
                        className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="mt-2 font-mono text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                      {railwayCnameValue}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-orange-700">
                    Add a CNAME record in your DNS provider pointing to the value above, then click &quot;Verify DNS&quot; again.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SSL Status */}
          {domainStatus.data && domainStatus.data.hasDomain && (
            <div
              className={`rounded-lg p-4 ${
                domainStatus.data.sslStatus === "active"
                  ? "bg-green-50 border border-green-200"
                  : "bg-yellow-50 border border-yellow-200"
              }`}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {domainStatus.data.sslStatus === "active" ? (
                    <svg
                      className="h-5 w-5 text-green-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5 text-yellow-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <h3
                    className={`text-sm font-medium ${
                      domainStatus.data.sslStatus === "active"
                        ? "text-green-900"
                        : "text-yellow-900"
                    }`}
                  >
                    SSL Certificate Status
                  </h3>
                  <div
                    className={`mt-1 text-sm ${
                      domainStatus.data.sslStatus === "active"
                        ? "text-green-800"
                        : "text-yellow-800"
                    }`}
                  >
                    <p>{domainStatus.data.message}</p>
                    {domainStatus.data.instructions && (
                      <div className="mt-2 space-y-1">
                        {domainStatus.data.instructions.map((instruction, idx) => (
                          <p key={idx} className="text-xs">
                            {instruction}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
         
        </div>
      ) : (
        <>
          <div className="mb-4 space-y-3">
            <div>
              <label
                htmlFor="custom-domain"
                className="block text-sm font-medium text-gray-700"
              >
                Your Domain
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="custom-domain"
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value.toLowerCase())}
                  placeholder="videos.acmecorp.com"
                  className="block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <button
                  onClick={handleVerify}
                  disabled={isVerifying || !domain.trim()}
                  className="whitespace-nowrap rounded-lg bg-purple-600 px-6 py-2 font-medium text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isVerifying ? "Verifying..." : "Verify DNS"}
                </button>
              </div>
            </div>
          </div>

          {/* DNS Configuration Required */}
          {needsDnsConfig && railwayCnameValue && (
            <div className="mb-4 rounded-lg border-2 border-orange-200 bg-orange-50 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-orange-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-orange-900">
                     DNS Configuration Required
                  </h3>
                  <p className="mt-1 text-sm text-orange-800">
                    Your domain has been added to Railway! Now configure your DNS to point to:
                  </p>
                  <div className="mt-3 rounded-lg bg-white p-3 border border-orange-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">CNAME Value:</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(railwayCnameValue);
                          toast.success("CNAME value copied to clipboard!");
                        }}
                        className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="mt-2 font-mono text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                      {railwayCnameValue}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-orange-700">
                    Add a CNAME record in your DNS provider pointing to the value above, then click &quot;Verify DNS&quot; again.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        localStorage.removeItem(`dns-config-${workspaceId}`);
                        setNeedsDnsConfig(false);
                        setRailwayCnameValue(null);
                        toast.success("DNS configuration cache cleared");
                      }}
                      className="text-xs text-orange-600 hover:text-orange-800 font-medium underline"
                    >
                      Clear Cache
                    </button>
                    <span className="text-xs text-orange-600">•</span>
                    <span className="text-xs text-orange-600">
                      Cache expires in 1 hour
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg bg-blue-50 p-4">
            <h3 className="mb-2 font-medium text-blue-900">
              Setup Instructions
            </h3>
            <ol className="space-y-2 text-sm text-blue-800">
              <li className="flex">
                <span className="mr-2 font-semibold">1.</span>
                <div className="flex-1">
                  <p className="font-medium">Add a CNAME record to your DNS:</p>
                  <div className="mt-2 rounded bg-white p-3 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-semibold">CNAME</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Name:</span>
                      <span className="font-semibold">{subdomain}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Value:</span>
                      <span className="font-semibold">{cnameTarget}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">TTL:</span>
                      <span className="font-semibold">3600</span>
                    </div>
                  </div>
                </div>
              </li>
              <li className="flex">
                <span className="mr-2 font-semibold">2.</span>
                <span>Wait 5-60 minutes for DNS to propagate</span>
              </li>
              <li className="flex">
                <span className="mr-2 font-semibold">3.</span>
                <span>
                  Click &quot;Verify DNS&quot; above.{" "}
                  {getDomainInstructions.data?.autoActivationEnabled ? (
                    <strong>SSL will be automatically activated! 🎉</strong>
                  ) : (
                    "We'll receive your request and activate your domain within 24 hours."
                  )}
                </span>
              </li>
              {/* <li className="flex">
                <span className="mr-2 font-semibold">4.</span>
                <span>
                  You'll receive an email when your domain is active with SSL.
                </span>
              </li> */}
            </ol>
          </div>

          {/* <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="mb-2 text-sm font-medium text-gray-900">
              🔍 Check DNS Propagation
            </h4>
            <p className="mb-2 text-xs text-gray-600">
              Use this command to verify your DNS is configured:
            </p>
            <code className="block rounded bg-gray-900 p-2 text-xs text-green-400">
              dig {domain || "your-domain.com"}
            </code>
            <p className="mt-2 text-xs text-gray-600">
              Should show CNAME pointing to: <code>{appDomain}</code>
            </p>
          </div> */}

          <div className="mt-4 rounded-lg border-l-4 border-yellow-400 bg-yellow-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>SSL Certificate Information:</strong> After DNS verification and
                  domain activation, an SSL certificate will be automatically provisioned
                  for your domain (takes 5-15 minutes). Your domain will be accessible via
                  HTTPS once the certificate is active. Activation typically takes less
                  than 24 hours.
                </p>
              </div>
            </div>
          </div>

          {getDomainInstructions.data?.sslNote && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-blue-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-800">
                    {getDomainInstructions.data.sslNote}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

