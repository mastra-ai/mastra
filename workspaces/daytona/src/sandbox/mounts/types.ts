/**
 * Shared types for Daytona mount operations.
 */

import type { Sandbox } from '@daytonaio/sdk';

import type { DaytonaAzureBlobMountConfig } from './azure';
import type { DaytonaGCSMountConfig } from './gcs';
import type { DaytonaS3MountConfig } from './s3';

export const LOG_PREFIX = '[@mastra/daytona]';

/**
 * Union of mount configs supported by Daytona sandbox.
 */
export type DaytonaMountConfig = DaytonaS3MountConfig | DaytonaGCSMountConfig | DaytonaAzureBlobMountConfig;

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

/**
 * Result of running a command in the Daytona sandbox.
 *
 * Note: Daytona's `executeCommand` returns a single combined string (stdout + stderr).
 * There is no separate stderr stream. If you need stderr isolated, redirect it in the
 * shell command itself (e.g. `2>/dev/null` or `2>&1`).
 */
export interface CommandResult {
  exitCode: number;
  /** Combined stdout/stderr output from the command. */
  output: string;
}

/**
 * Run a command in the Daytona sandbox.
 *
 * Thin wrapper around `sandbox.process.executeCommand` that converts timeout
 * from milliseconds to seconds and null-coalesces the output string.
 *
 * Does NOT throw on non-zero exit codes — callers should check `exitCode`.
 */
export async function runCommand(
  sandbox: Sandbox,
  command: string,
  options?: { timeout?: number },
): Promise<CommandResult> {
  const result = await sandbox.process.executeCommand(
    command,
    undefined, // cwd
    undefined, // env
    options?.timeout !== undefined ? Math.ceil(options.timeout / 1000) : undefined,
  );

  return {
    exitCode: result.exitCode,
    output: result.result ?? '',
  };
}
