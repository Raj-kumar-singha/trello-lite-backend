import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import dotenv from "dotenv";
dotenv.config();

// Read environment variables
const R2_ENDPOINT = process.env.CLOUDFLARE_R2_ENDPOINT?.trim();
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim();
const R2_SECRET_ACCESS_KEY =
  process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim();
const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim();
const PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL?.trim();

// Validate required environment variables
const isR2Configured =
  R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && BUCKET_NAME;

// Cloudflare R2 configuration (S3-compatible)
// Only create client if credentials are available
let r2Client = null;
if (isR2Configured) {
  r2Client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true, // Required for R2
  });
}

/**
 * Upload file to Cloudflare R2
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} originalName - Original filename
 * @param {string} mimetype - File MIME type
 * @returns {Promise<{filename: string, url: string, size: number}>}
 */
export const uploadToR2 = async (fileBuffer, originalName, mimetype) => {
  if (!isR2Configured || !r2Client) {
    throw new Error(
      "Cloudflare R2 is not configured. Please set the required environment variables in your .env file."
    );
  }

  try {
    const fileExtension = originalName.includes(".")
      ? originalName.substring(originalName.lastIndexOf("."))
      : "";
    const uniqueFilename = `${randomUUID()}${fileExtension}`;
    const key = `attachments/${uniqueFilename}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: mimetype,
    });

    await r2Client.send(command);

    // Generate public URL
    let url;
    if (PUBLIC_URL) {
      // Use custom public URL
      url = `${PUBLIC_URL.replace(/\/$/, "")}/${key}`;
    } else if (R2_ENDPOINT) {
      // Construct URL from endpoint (for R2 public buckets)
      // R2 endpoint format: https://<account-id>.r2.cloudflarestorage.com
      const endpointHost = R2_ENDPOINT.replace("https://", "").replace(
        "http://",
        ""
      );
      url = `https://${BUCKET_NAME}.${endpointHost}/${key}`;
    } else {
      // Fallback
      url = `https://${BUCKET_NAME}.r2.dev/${key}`;
    }

    return {
      filename: uniqueFilename,
      key: key,
      url: url,
      size: fileBuffer.length,
      originalName: originalName,
    };
  } catch (error) {
    console.error("Error uploading to R2:", error);
    if (error.message.includes("credential")) {
      throw new Error(
        "Invalid Cloudflare R2 credentials. Please check your environment variables."
      );
    }
    throw new Error(`Failed to upload file to Cloudflare R2: ${error.message}`);
  }
};

/**
 * Delete file from Cloudflare R2
 * @param {string} key - File key in R2
 * @returns {Promise<void>}
 */
export const deleteFromR2 = async (key) => {
  if (!isR2Configured || !r2Client) {
    console.warn(
      "Cloudflare R2 not configured. Skipping file deletion from R2."
    );
    return;
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
  } catch (error) {
    console.error("Error deleting from R2:", error);
    // Don't throw error, just log it - file might already be deleted
  }
};

/**
 * Generate presigned URL for private files (if needed)
 * @param {string} key - File key in R2
 * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>}
 */
export const getPresignedUrl = async (key, expiresIn = 3600) => {
  if (!isR2Configured || !r2Client) {
    throw new Error(
      "Cloudflare R2 is not configured. Please set the required environment variables."
    );
  }

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    throw new Error("Failed to generate file URL");
  }
};
