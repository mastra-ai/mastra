/**
 * Shared test helpers for workspace providers.
 */

import type { WorkspaceFilesystem } from '@mastra/core/workspace';

/**
 * Directory structure for creating test files.
 * Values can be:
 * - string: text file content
 * - Buffer: binary file content
 * - nested object: subdirectory
 */
export interface TestDirectoryStructure {
  [name: string]: string | Buffer | TestDirectoryStructure;
}

/**
 * Generate random text content of specified size.
 */
export function generateTextContent(sizeBytes: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\n ';
  let result = '';
  for (let i = 0; i < sizeBytes; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random binary content.
 */
export function generateBinaryContent(sizeBytes: number): Buffer {
  const buffer = Buffer.alloc(sizeBytes);
  for (let i = 0; i < sizeBytes; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  return buffer;
}

/**
 * Generate a unique test path with optional prefix.
 */
export function generateTestPath(prefix = 'test'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `/${prefix}-${timestamp}-${random}`;
}

/**
 * Create a test directory structure in a filesystem.
 */
export async function createTestStructure(
  fs: WorkspaceFilesystem,
  basePath: string,
  structure: TestDirectoryStructure,
): Promise<void> {
  for (const [name, content] of Object.entries(structure)) {
    const fullPath = `${basePath}/${name}`.replace(/\/+/g, '/');

    if (typeof content === 'string' || Buffer.isBuffer(content)) {
      // File
      await fs.writeFile(fullPath, content);
    } else {
      // Directory - recurse
      await fs.mkdir(fullPath, { recursive: true });
      await createTestStructure(fs, fullPath, content);
    }
  }
}

/**
 * Clean up a test directory and all its contents.
 */
export async function cleanupTestPath(fs: WorkspaceFilesystem, path: string): Promise<void> {
  try {
    const exists = await fs.exists(path);
    if (exists) {
      const stat = await fs.stat(path);
      if (stat.type === 'directory') {
        await fs.rmdir(path, { recursive: true, force: true });
      } else {
        await fs.deleteFile(path, { force: true });
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Wait for a condition to be true, with timeout.
 */
export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  timeoutMs = 5000,
  intervalMs = 100,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timeout waiting for condition after ${timeoutMs}ms`);
}

/**
 * Skip test if environment variable is not set.
 * Returns the value if set, throws skip otherwise.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Skipping: ${name} environment variable not set`);
  }
  return value;
}

/**
 * Check if integration test credentials are available.
 */
export function hasCredentials(provider: 'aws' | 'gcs' | 'e2b' | 'r2'): boolean {
  switch (provider) {
    case 'aws':
      return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_TEST_BUCKET);
    case 'gcs':
      return !!(process.env.GCS_SERVICE_ACCOUNT_KEY || process.env.GCS_HMAC_ACCESS_KEY);
    case 'e2b':
      return !!process.env.E2B_API_KEY;
    case 'r2':
      return !!(process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_ENDPOINT);
    default:
      return false;
  }
}
