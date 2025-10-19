"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";

// Force dynamic rendering (don't prerender at build time)
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const previousJobsRef = useRef<Map<string, string>>(new Map());

  const { data: credits, refetch: refetchCredits } =
    api.video.getCredits.useQuery({});
  const { data: jobs, refetch: refetchJobs } = api.video.getJobs.useQuery(
    { limit: 10 },
    { refetchInterval: 5000 }, // Poll every 5 seconds
  );

  const createUploadUrl = api.video.createUploadUrl.useMutation();
  const confirmUpload = api.video.confirmUpload.useMutation();
  const createCheckout = api.payment.createCheckoutSession.useMutation();
  const retryJob = api.video.retryJob.useMutation();

  // Monitor job status changes and show toast notifications
  useEffect(() => {
    if (!jobs) return;

    jobs.forEach((job) => {
      const previousStatus = previousJobsRef.current.get(job.id);

      // If this is a new job or status changed
      if (previousStatus && previousStatus !== job.status) {
        if (job.status === "completed") {
          toast.success(`Video processed successfully!`, {
            description: `${job.originalFilename} is ready to download`,
            action: {
              label: "Download",
              onClick: () =>
                (window.location.href = `/dashboard/jobs/${job.id}`),
            },
            duration: 10000,
          });
        } else if (job.status === "failed") {
          toast.error(`Video processing failed`, {
            description:
              job.error || `${job.originalFilename} could not be processed`,
            duration: 10000,
          });
        } else if (job.status === "processing") {
          toast.info(`Processing started`, {
            description: `${job.originalFilename} is now being processed`,
          });
        }
      }

      // Update the previous status
      previousJobsRef.current.set(job.id, job.status);
    });
  }, [jobs]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 300 * 1024 * 1024) {
        toast.error("File too large", {
          description: "File size must be less than 300MB",
        });
        return;
      }
      setSelectedFile(file);
      toast.success("File selected", {
        description: `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      setUploadProgress(0);

      // Get upload URL
      const { uploadUrl, jobId, fileKey, contentType } =
        await createUploadUrl.mutateAsync({
          filename: selectedFile.name,
          fileSize: selectedFile.size,
          fileType: selectedFile.type || "application/octet-stream",
        });

      // Upload to R2
      setUploadProgress(30);
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: selectedFile,
        headers: {
          "Content-Type": contentType,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      setUploadProgress(70);

      // Confirm upload and start processing
      await confirmUpload.mutateAsync({
        jobId,
        fileKey,
        filename: selectedFile.name,
        fileSize: selectedFile.size,
      });

      setUploadProgress(100);

      // Reset state
      setSelectedFile(null);
      setUploading(false);

      // Refetch data
      await refetchCredits();
      await refetchJobs();

      toast.success("Video uploaded successfully!", {
        description:
          "Processing will begin shortly. You'll be notified when it's ready.",
        duration: 5000,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Upload failed", {
        description:
          error instanceof Error
            ? error.message
            : "An error occurred during upload",
      });
      setUploading(false);
    }
  };

  const handleBuyCredits = async () => {
    try {
      const { url } = await createCheckout.mutateAsync({});
      toast.loading("Redirecting to checkout...");
      window.location.href = url;
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Checkout failed", {
        description: "Failed to create checkout session. Please try again.",
      });
    }
  };

  const handleRetry = async (jobId: string) => {
    // Show a confirmation toast
    toast.info("Confirm retry", {
      description: "This will use 1 credit. Click 'Retry' to continue.",
      action: {
        label: "Retry",
        onClick: async () => {
          try {
            const toastId = toast.loading("Re-queueing job...");
            await retryJob.mutateAsync({ jobId });
            await refetchCredits();
            await refetchJobs();
            toast.success("Job re-queued!", {
              id: toastId,
              description: "Your video will be processed again shortly.",
            });
          } catch (error) {
            console.error("Retry error:", error);
            toast.error("Retry failed", {
              description:
                error instanceof Error ? error.message : "Failed to retry job",
            });
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => {},
      },
      duration: 10000,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "queued":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-2 text-gray-600">Upload and manage your videos</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-white px-4 py-2 shadow">
              <span className="text-sm text-gray-600">Credits: </span>
              <span className="text-lg font-bold text-purple-600">
                {credits?.credits ?? 0}
              </span>
            </div>
            <button
              onClick={handleBuyCredits}
              disabled={createCheckout.isPending}
              className="rounded-lg bg-purple-600 px-4 py-2 text-white transition hover:bg-purple-700 disabled:opacity-50"
            >
              Buy Credits
            </button>
          </div>
        </div>

        {/* Upload Section */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Upload Video
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex-1">
                <div className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-12 transition hover:border-purple-500">
                  {selectedFile ? (
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-900">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                      >
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <p className="mt-2 text-sm text-gray-600">
                        Click to select video or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">MP4 up to 300MB</p>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="video/mp4,video/x-m4v,video/*"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
              </label>
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full bg-purple-600 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-center text-sm text-gray-600">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={
                !selectedFile || uploading || (credits?.credits ?? 0) <= 0
              }
              className="w-full rounded-lg bg-purple-600 px-4 py-3 font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading
                ? "Uploading..."
                : (credits?.credits ?? 0) <= 0
                  ? "No Credits Available"
                  : "Upload and Process"}
            </button>
          </div>
        </div>

        {/* Jobs List */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Recent Jobs
          </h2>
          {!jobs || jobs.length === 0 ? (
            <p className="py-8 text-center text-gray-500">
              No videos uploaded yet
            </p>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4 transition hover:border-purple-300"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {job.originalFilename}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(job.createdAt).toLocaleString()}
                    </p>
                    {job.status === "failed" && job.error && (
                      <p className="mt-1 text-xs text-red-600">
                        Error: {job.error}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(job.status)}`}
                    >
                      {job.status}
                    </span>
                    {job.status === "completed" && (
                      <a
                        href={`/dashboard/jobs/${job.id}`}
                        className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white transition hover:bg-purple-700"
                      >
                        Download
                      </a>
                    )}
                    {job.status === "failed" && (
                      <button
                        onClick={() => handleRetry(job.id)}
                        disabled={retryJob.isPending}
                        className="rounded-lg bg-orange-600 px-4 py-2 text-sm text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {retryJob.isPending ? "Retrying..." : "Retry"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
