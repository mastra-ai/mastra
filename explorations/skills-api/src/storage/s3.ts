/**
 * S3-compatible storage for skills data
 * Works with AWS S3, MinIO, Cloudflare R2, etc.
 */

import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

import type { ScrapedData } from '../registry/types.js';

const S3_BUCKET = process.env.S3_BUCKET;
const S3_KEY = process.env.S3_KEY || 'skills-data.json';
const S3_REGION = process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1';
const S3_ENDPOINT = process.env.S3_ENDPOINT; // For S3-compatible services (MinIO, R2, etc.)

let s3Client: S3Client | null = null;

/**
 * Check if S3 storage is configured
 */
export function isS3Configured(): boolean {
  return !!S3_BUCKET;
}

/**
 * Get or create S3 client
 */
function getS3Client(): S3Client {
  if (!s3Client) {
    const config: ConstructorParameters<typeof S3Client>[0] = {
      region: S3_REGION,
    };

    // Support S3-compatible endpoints (MinIO, R2, etc.)
    if (S3_ENDPOINT) {
      config.endpoint = S3_ENDPOINT;
      config.forcePathStyle = true; // Required for most S3-compatible services
    }

    s3Client = new S3Client(config);
  }
  return s3Client;
}

/**
 * Load skills data from S3
 */
export async function loadFromS3(): Promise<ScrapedData | null> {
  if (!S3_BUCKET) {
    return null;
  }

  try {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: S3_KEY,
    });

    const response = await client.send(command);
    const body = await response.Body?.transformToString();

    if (!body) {
      console.warn('[S3] Empty response from S3');
      return null;
    }

    console.info(`[S3] Loaded data from s3://${S3_BUCKET}/${S3_KEY}`);
    return JSON.parse(body) as ScrapedData;
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === 'NoSuchKey' || err.name === 'NotFound') {
      console.info('[S3] No existing data in S3, will use bundled data');
      return null;
    }
    console.error('[S3] Failed to load from S3:', err.message);
    return null;
  }
}

/**
 * Save skills data to S3
 */
export async function saveToS3(data: ScrapedData): Promise<boolean> {
  if (!S3_BUCKET) {
    console.warn('[S3] S3_BUCKET not configured, skipping S3 save');
    return false;
  }

  try {
    const client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: S3_KEY,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
    });

    await client.send(command);
    console.info(`[S3] Saved data to s3://${S3_BUCKET}/${S3_KEY}`);
    return true;
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[S3] Failed to save to S3:', err.message);
    return false;
  }
}

/**
 * Check if data exists in S3
 */
export async function existsInS3(): Promise<boolean> {
  if (!S3_BUCKET) {
    return false;
  }

  try {
    const client = getS3Client();
    const command = new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: S3_KEY,
    });

    await client.send(command);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get S3 storage info
 */
export function getS3Info(): {
  configured: boolean;
  bucket: string | null;
  key: string;
  endpoint: string | null;
  region: string;
} {
  return {
    configured: isS3Configured(),
    bucket: S3_BUCKET || null,
    key: S3_KEY,
    endpoint: S3_ENDPOINT || null,
    region: S3_REGION,
  };
}
