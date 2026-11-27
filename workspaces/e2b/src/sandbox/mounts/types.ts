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
 * Owner of the files inside a FUSE mount, as numeric uid/gid.
 *
 * Set this when commands run as a different OS user than the one the sandbox
 * mounts as, so that user can read and write the mounted files. Without it the
 * mount probes `id -u && id -g` and the files are owned by the default user.
 */
export interface MountOwner {
  uid: number;
  gid: number;
}

const SAFE_S3_BUCKET_NAME = /^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$/;
const SAFE_GCS_BUCKET_NAME = /^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/;

export function validateS3BucketName(bucket: string): void {
  if (!SAFE_S3_BUCKET_NAME.test(bucket)) {
    throw new Error(
      `Invalid S3 bucket name: "${bucket}". Bucket names must be 3-63 characters, lowercase alphanumeric, hyphens, or dots.`,
    );
  }
}

export function validateGCSBucketName(bucket: string): void {
  if (!SAFE_GCS_BUCKET_NAME.test(bucket)) {
    throw new Error(
      `Invalid GCS bucket name: "${bucket}". Bucket names must be 3-63 characters, lowercase alphanumeric, hyphens, underscores, or dots.`,
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
 * Validate an AWS region (or R2's "auto") before interpolating into shell commands.
 * Accepts standard AWS region codes like "us-east-1", "ap-northeast-1", and "auto".
 */
const SAFE_REGION = /^[a-z0-9-]{2,32}$/;

export function validateRegion(region: unknown): asserts region is string {
  if (typeof region !== 'string' || !SAFE_REGION.test(region)) {
    throw new Error(
      `Invalid region: ${JSON.stringify(region)}. Region must be a string of lowercase alphanumeric or hyphens (e.g., "us-east-1", "ap-northeast-1", "auto").`,
    );
  }
}

/**
 * Validate a mount owner before interpolating uid/gid into shell commands.
 */
export function validateOwner(owner: unknown): asserts owner is MountOwner {
  if (owner === undefined) {
    throw new Error('Invalid mount owner: expected an object with numeric "uid" and "gid".');
  }
  const { uid, gid } = owner as { uid?: unknown; gid?: unknown };
  if (!Number.isInteger(uid) || (uid as number) < 0 || !Number.isInteger(gid) || (gid as number) < 0) {
    throw new Error(
      `Invalid mount owner: ${JSON.stringify(owner)}. "uid" and "gid" must both be non-negative integers.`,
    );
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
