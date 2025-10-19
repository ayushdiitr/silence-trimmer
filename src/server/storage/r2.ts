import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "~/env";

// Initialize S3 client for Cloudflare R2
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Generate a presigned URL for uploading a file to R2
 * @param key - The S3 key (path) for the file
 * @param contentType - The content type of the file (optional)
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 */
export async function generatePresignedUploadUrl(
  key: string,
  contentType?: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    // Specify content type to ensure presigned URL matches actual upload
    ContentType: contentType || "application/octet-stream",
  });

  return await getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Generate a presigned URL for downloading a file from R2
 * @param key - The S3 key (path) for the file
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 */
export async function generatePresignedDownloadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Delete a file from R2
 * @param key - The S3 key (path) for the file
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
  });

  await r2Client.send(command);
}

/**
 * Get a file from R2 as a stream
 * @param key - The S3 key (path) for the file
 */
export async function getFileStream(key: string) {
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
  });

  const response = await r2Client.send(command);
  return response.Body;
}

/**
 * Upload a file to R2
 * @param key - The S3 key (path) for the file
 * @param body - The file content
 */
export async function uploadFile(key: string, body: Buffer | Uint8Array | string) {
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    Body: body,
  });

  await r2Client.send(command);
}

/**
 * Get the public URL for a file (if bucket is configured with public access)
 * @param key - The S3 key (path) for the file
 */
export function getPublicUrl(key: string): string {
  return `${env.R2_PUBLIC_URL}/${key}`;
}

