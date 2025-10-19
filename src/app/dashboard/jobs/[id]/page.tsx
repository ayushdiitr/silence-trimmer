"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { api } from "~/trpc/react";

// Force dynamic rendering (don't prerender at build time)
export const dynamic = "force-dynamic";

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params.id as string;

  const { data: job, refetch } = api.video.getJobStatus.useQuery(
    { jobId },
    {
      refetchInterval: (query) => {
        const data = query.state.data;
        return data?.status === "completed" || data?.status === "failed"
          ? false
          : 3000;
      },
    },
  );

  useEffect(() => {
    // Refetch every 3 seconds if still processing
    if (job?.status === "processing" || job?.status === "queued") {
      const interval = setInterval(() => {
        void refetch();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [job?.status, refetch]);

  if (!job) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-purple-600 border-t-transparent"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

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
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {job.originalFilename}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Uploaded {new Date(job.createdAt).toLocaleString()}
              </p>
            </div>
            <span
              className={`rounded-full px-4 py-2 text-sm font-semibold ${getStatusColor(job.status)}`}
            >
              {job.status}
            </span>
          </div>

          <div className="space-y-4">
            {job.status === "queued" && (
              <div className="rounded-lg bg-yellow-50 p-4">
                <div className="flex items-center">
                  <div className="mr-4 h-8 w-8 animate-spin rounded-full border-4 border-yellow-600 border-t-transparent"></div>
                  <div>
                    <h3 className="font-semibold text-yellow-900">
                      Job Queued
                    </h3>
                    <p className="text-sm text-yellow-700">
                      Your video is waiting in the queue. Processing will start
                      soon.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {job.status === "processing" && (
              <div className="rounded-lg bg-blue-50 p-4">
                <div className="flex items-center">
                  <div className="mr-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                  <div>
                    <h3 className="font-semibold text-blue-900">Processing</h3>
                    <p className="text-sm text-blue-700">
                      Removing silences and processing your video. This may take
                      a few minutes.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {job.status === "completed" && job.downloadUrl && (
              <div className="rounded-lg bg-green-50 p-4">
                <div className="mb-4">
                  <h3 className="font-semibold text-green-900">
                    Processing Complete! 🎉
                  </h3>
                  <p className="text-sm text-green-700">
                    Your video has been processed successfully. Download it
                    below.
                  </p>
                </div>
                <a
                  href={job.downloadUrl}
                  download
                  className="inline-block rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700"
                >
                  Download Processed Video
                </a>
                <p className="mt-2 text-xs text-green-700">
                  Download link expires in 24 hours
                </p>
              </div>
            )}

            {job.status === "failed" && (
              <div className="rounded-lg bg-red-50 p-4">
                <h3 className="font-semibold text-red-900">
                  Processing Failed
                </h3>
                <p className="mt-2 text-sm text-red-700">
                  {job.error || "An unknown error occurred"}
                </p>
                <p className="mt-2 text-sm text-red-700">
                  Your credit has been refunded. Please try uploading again.
                </p>
              </div>
            )}

            {/* Job Details */}
            <div className="mt-6 border-t pt-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                Job Details
              </h3>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Job ID</dt>
                  <dd className="mt-1 font-mono text-sm text-gray-900">
                    {job.id}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    File Size
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {job.fileSize
                      ? `${(job.fileSize / 1024 / 1024).toFixed(2)} MB`
                      : "N/A"}
                  </dd>
                </div>
                {job.duration && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Duration
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {job.duration} seconds
                    </dd>
                  </div>
                )}
                {job.completedAt && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Completed At
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(job.completedAt).toLocaleString()}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
