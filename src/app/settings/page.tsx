"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";

// Force dynamic rendering (don't prerender at build time)
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const { data: workspaces } = api.workspace.getMyWorkspaces.useQuery();
  const { data: currentWorkspace, refetch } = api.workspace.getById.useQuery(
    {},
  );
  const updateWorkspace = api.workspace.update.useMutation();
  const verifyDomain = api.workspace.verifyDomain.useMutation();
  const removeDomain = api.workspace.removeDomain.useMutation();
  const { data: domainInstructions } = api.workspace.getDomainInstructions.useQuery({});

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#7c3aed");
  const [customDomain, setCustomDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // Initialize form when workspace loads
  useState(() => {
    if (currentWorkspace) {
      setName(currentWorkspace.name);
      setLogoUrl(currentWorkspace.logoUrl ?? "");
      setPrimaryColor(currentWorkspace.primaryColor!);
      setCustomDomain(currentWorkspace.customDomain ?? "");
    }
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await updateWorkspace.mutateAsync({
        name: name || undefined,
        logoUrl: logoUrl || null,
        primaryColor: primaryColor || undefined,
      });

      await refetch();
      toast.success("Settings saved successfully!");
    } catch (error) {
      console.error("Save error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save settings",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyDomain = async () => {
    if (!customDomain) {
      toast.error("Please enter a domain");
      return;
    }

    setVerifying(true);

    try {
      const result = await verifyDomain.mutateAsync({ domain: customDomain });
      await refetch();
      toast.success(result.message);
      setShowInstructions(false);
    } catch (error) {
      console.error("Verify error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to verify domain. Please check your DNS settings.",
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleRemoveDomain = async () => {
    if (!confirm("Are you sure you want to remove the custom domain?")) {
      return;
    }

    try {
      await removeDomain.mutateAsync({});
      await refetch();
      setCustomDomain("");
      toast.success("Custom domain removed successfully!");
    } catch (error) {
      console.error("Remove error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to remove domain",
      );
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-purple-600 border-t-transparent"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <a
            href="/dashboard"
            className="text-purple-600 transition hover:text-purple-700"
          >
            ← Back to Dashboard
          </a>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h1 className="mb-6 text-2xl font-bold text-gray-900">
            Workspace Settings
          </h1>

          <form onSubmit={handleSave} className="space-y-6">
            {/* Workspace Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Workspace Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                placeholder="My Workspace"
              />
            </div>

            {/* Logo URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Logo URL
              </label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                placeholder="https://example.com/logo.png"
              />
              <p className="mt-1 text-sm text-gray-500">
                Enter the URL of your logo image
              </p>
              {logoUrl && (
                <div className="mt-2">
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="h-16 w-auto rounded"
                    onError={(e) => {
                      e.currentTarget.src = "";
                      e.currentTarget.alt = "Failed to load image";
                    }}
                  />
                </div>
              )}
            </div>

            {/* Primary Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Primary Color
              </label>
              <div className="mt-1 flex items-center gap-4">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-12 w-20 cursor-pointer rounded-lg border border-gray-300"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  placeholder="#7c3aed"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
              <p className="mt-1 text-sm text-gray-500">
                This color will be used throughout your white-labeled site
              </p>
            </div>

            {/* Custom Domain */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Custom Domain
              </label>
              
              {currentWorkspace.customDomain ? (
                <div className="mt-2 rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="flex items-center gap-2 font-medium text-green-900">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Domain Active
                      </p>
                      <p className="mt-1 text-sm text-green-700">
                        {currentWorkspace.customDomain}
                      </p>
                    </div>
                    <button
                      onClick={handleRemoveDomain}
                      className="rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-200"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    placeholder="videos.yourdomain.com"
                  />
                  
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={handleVerifyDomain}
                      disabled={verifying || !customDomain}
                      className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {verifying ? "Verifying..." : "Verify Domain"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInstructions(!showInstructions)}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      {showInstructions ? "Hide" : "Show"} Instructions
                    </button>
                  </div>

                  {showInstructions && domainInstructions && (
                    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <h4 className="font-medium text-blue-900">
                        DNS Configuration Instructions
                      </h4>
                      <ol className="mt-3 space-y-2 text-sm text-blue-800">
                        {domainInstructions.instructions.map((instruction, index) => (
                          <li key={index} className={instruction.startsWith("  ") ? "ml-4 font-mono text-xs" : ""}>
                            {index + 1}. {instruction}
                          </li>
                        ))}
                      </ol>
                      <div className="mt-4 rounded bg-blue-100 p-3">
                        <p className="text-sm font-medium text-blue-900">
                          CNAME Target:
                        </p>
                        <code className="mt-1 block rounded bg-white px-2 py-1 text-sm text-blue-900">
                          {domainInstructions.cnameTarget}
                        </code>
                      </div>
                    </div>
                  )}

                  <p className="mt-2 text-sm text-gray-500">
                    Configure your DNS and verify to enable white-label custom domain
                  </p>
                </>
              )}
            </div>

            {/* Current Credits Display */}
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Current Credits</h3>
                  <p className="text-sm text-gray-500">
                    Available credits for video processing
                  </p>
                </div>
                <div className="text-3xl font-bold text-purple-600">
                  {currentWorkspace.credits}
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end gap-4 border-t pt-6">
              <a
                href="/dashboard"
                className="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </a>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-purple-600 px-6 py-2 text-white transition hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>

        {/* Workspace Info */}
        <div className="mt-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Workspace Information
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Workspace ID
              </dt>
              <dd className="mt-1 font-mono text-sm text-gray-900">
                {currentWorkspace.id}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Slug</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {currentWorkspace.slug}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(currentWorkspace.createdAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
