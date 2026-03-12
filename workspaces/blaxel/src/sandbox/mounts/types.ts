/**
 * Shared types for Blaxel mount operations.
 */

import type { SandboxInstance } from '@blaxel/core';

export const LOG_PREFIX = '[@mastra/blaxel]';

import type { BlaxelGCSMountConfig } from './gcs';
import type { BlaxelS3MountConfig } from './s3';

/**
 * Union of mount configs supported by Blaxel sandbox.
 */
export type BlaxelMountConfig = BlaxelS3MountConfig | BlaxelGCSMountConfig;

/**
 * Context for mount operations.
 */
export interface MountContext {
  sandbox: SandboxInstance;
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

/**
 * Detected system package manager.
 */
export type PackageManager = 'apt' | 'apk' | 'unknown';

/**
 * Detect the system package manager available in the sandbox.
 * Returns 'apt' for Debian/Ubuntu, 'apk' for Alpine, or 'unknown'.
 */
export async function detectPackageManager(sandbox: SandboxInstance): Promise<PackageManager> {
  const result = await runCommand(
    sandbox,
    'which apt-get >/dev/null 2>&1 && echo "apt" || (which apk >/dev/null 2>&1 && echo "apk" || echo "unknown")',
  );
  const pm = result.stdout.trim();
  if (pm === 'apt') return 'apt';
  if (pm === 'apk') return 'apk';
  return 'unknown';
}

/**
 * Run a command in the Blaxel sandbox and return the result.
 * Wraps the process.exec API to match the command execution pattern used in mount operations.
 *
 * Does NOT throw on non-zero exit codes — callers should check `exitCode` themselves.
 */
export async function runCommand(
  sandbox: SandboxInstance,
  command: string,
  options?: { timeout?: number },
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const result = await sandbox.process.exec({
    command,
    waitForCompletion: true,
    ...(options?.timeout && { timeout: Math.ceil(options.timeout / 1000) }),
  });

  return {
    exitCode: result.exitCode ?? 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}
