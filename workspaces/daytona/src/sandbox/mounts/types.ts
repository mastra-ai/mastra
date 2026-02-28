/**
 * Shared types for Daytona mount operations.
 */

import type { DaytonaGCSMountConfig } from './gcs';
import type { DaytonaS3MountConfig } from './s3';

export const LOG_PREFIX = '[@mastra/daytona]';

/**
 * Union of mount configs supported by Daytona sandbox.
 */
export type DaytonaMountConfig = DaytonaS3MountConfig | DaytonaGCSMountConfig;

/**
 * Context for mount operations.
 * Abstracts over the Daytona SDK so mount helpers stay SDK-agnostic.
 */
export interface MountContext {
  run: (cmd: string, timeoutMs?: number) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  writeFile: (path: string, content: string) => Promise<void>;
  logger: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
}

/**
 * Validate a bucket name before interpolating into shell commands.
 * Covers S3, GCS, and S3-compatible (R2, MinIO) naming rules.
 */
const SAFE_BUCKET_NAME = /^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$/;

export function validateBucketName(bucket: string): void {
  if (!SAFE_BUCKET_NAME.test(bucket)) {
    throw new Error(
      `Invalid bucket name: "${bucket}". Bucket names must be 3-63 characters, lowercase alphanumeric, hyphens, or dots.`,
    );
  }
}

/**
 * Validate an endpoint URL before interpolating into shell commands.
 * Only http and https schemes are allowed.
 */
export function validateEndpoint(endpoint: string): void {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error(`Invalid endpoint URL: "${endpoint}"`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid endpoint URL scheme: "${parsed.protocol}". Only http: and https: are allowed.`);
  }
}
