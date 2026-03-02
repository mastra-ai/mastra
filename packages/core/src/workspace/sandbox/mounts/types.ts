/**
 * Shared types for local mount operations.
 */

export const LOG_PREFIX = '[LocalSandbox]';

/**
 * Context for local mount operations.
 * Uses a run function instead of E2B's sandbox.commands.run().
 */
export interface LocalMountContext {
  run: (
    command: string,
    args: string[],
    options?: { timeout?: number },
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  platform: NodeJS.Platform;
  logger: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
}

/**
 * Error thrown when a required FUSE tool (s3fs, gcsfuse, macFUSE) is not installed.
 *
 * Distinguished from general mount errors so `LocalSandbox.mount()` can mark the
 * mount as `unavailable` (warning) rather than `error`. The workspace still works
 * via SDK filesystem methods — only sandbox process access to the mount path is affected.
 */
export class MountToolNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MountToolNotFoundError';
  }
}

/**
 * Validate a bucket name before interpolating into shell commands.
 * Covers S3, GCS, and S3-compatible (R2, MinIO) naming rules.
 */
const SAFE_BUCKET_NAME = /^[a-z0-9][a-z0-9.\-_]{1,61}[a-z0-9]$/;
const IPV4_LIKE_BUCKET = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export function validateBucketName(bucket: string): void {
  if (!SAFE_BUCKET_NAME.test(bucket)) {
    throw new Error(
      `Invalid bucket name: "${bucket}". Bucket names must be 3-63 characters, lowercase alphanumeric, hyphens, underscores, or dots.`,
    );
  }
  if (bucket.includes('..') || bucket.includes('-.') || bucket.includes('.-') || IPV4_LIKE_BUCKET.test(bucket)) {
    throw new Error(`Invalid bucket name: "${bucket}".`);
  }
}

/**
 * Validate an endpoint URL before interpolating into shell commands.
 * Only http:// and https:// schemes are allowed for shell safety.
 */
export function validateEndpoint(endpoint: string): void {
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Invalid endpoint URL protocol: "${parsed.protocol}"`);
    }
  } catch {
    throw new Error(`Invalid endpoint URL: "${endpoint}"`);
  }
}
