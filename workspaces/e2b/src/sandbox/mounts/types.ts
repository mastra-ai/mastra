/**
 * Shared types for E2B mount operations.
 */

import type { Sandbox } from 'e2b';

import type { E2BAzureBlobMountConfig } from './azure';
import type { E2BGCSMountConfig } from './gcs';
import type { E2BS3MountConfig } from './s3';

export const LOG_PREFIX = '[@mastra/e2b]';

/**
 * Union of mount configs supported by E2B sandbox.
 */
export type E2BMountConfig = E2BS3MountConfig | E2BGCSMountConfig | E2BAzureBlobMountConfig;

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

/**
 * Validate and normalize a mount prefix before interpolating into shell commands.
 * Returns the normalized prefix (no leading/trailing slashes).
 *
 * Shell safety is handled by shellQuote() at the call site, so this function
 * only enforces path-level rules (no traversal, no empty result, no control chars).
 */
export function validatePrefix(prefix: string): string {
  // Trim leading/trailing slashes
  let normalized = prefix;
  while (normalized.startsWith('/')) normalized = normalized.slice(1);
  while (normalized.endsWith('/')) normalized = normalized.slice(0, -1);

  if (!normalized) {
    throw new Error('Mount prefix cannot be empty after normalization.');
  }
  if (normalized.includes('//') || normalized.split('/').some(s => s === '.' || s === '..')) {
    throw new Error(`Invalid mount prefix: "${prefix}". Path traversal is not allowed.`);
  }
  // Block control characters (U+0000–U+001F, U+007F) which are invalid in filesystem paths
  if (/[\x00-\x1f\x7f]/.test(normalized)) {
    throw new Error(`Invalid mount prefix: "${prefix}". Control characters are not allowed.`);
  }
  return normalized;
}
