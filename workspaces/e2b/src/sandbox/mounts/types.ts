/**
 * Shared types for E2B mount operations.
 */

import type { Sandbox } from 'e2b';

export const LOG_PREFIX = '[@mastra/e2b]';

import type { E2BGCSMountConfig } from './gcs';
import type { E2BS3MountConfig } from './s3';

/**
 * Union of mount configs supported by E2B sandbox.
 */
export type E2BMountConfig = E2BS3MountConfig | E2BGCSMountConfig;

/**
 * Context for mount operations.
 */
export interface MountContext {
  sandbox: Sandbox;
  logger: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
}

/**
 * Result of a mount operation.
 */
export interface MountOperationResult {
  success: boolean;
  error?: string;
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
 */
export function validateEndpoint(endpoint: string): void {
  try {
    new URL(endpoint);
  } catch {
    throw new Error(`Invalid endpoint URL: "${endpoint}"`);
  }
}
