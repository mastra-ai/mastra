/**
 * FilesSDK Filesystem Integration Tests
 *
 * Runs the shared `@internal/workspace-test-utils` conformance suite against a
 * real FilesSDK `Files` instance backed by the local `fs` adapter pointed at a
 * temporary directory. This validates the full FilesSDKFilesystem implementation
 * end-to-end without requiring any cloud credentials.
 *
 * The same `FilesSDKFilesystem` class is what users wire to S3, R2, GCS, Azure,
 * Vercel Blob, etc. via FilesSDK — so passing this suite against the `fs`
 * adapter exercises every code path that doesn't depend on cloud-specific
 * behavior.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createFilesystemTestSuite } from '@internal/workspace-test-utils';
import { Files } from 'files-sdk';
import { fs as fsAdapter } from 'files-sdk/fs';
import { afterAll } from 'vitest';

import { FilesSDKFilesystem } from './index';

// Track all tmp dirs created during this run so we can clean them up.
const tmpDirs: string[] = [];

afterAll(() => {
  for (const dir of tmpDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup.
    }
  }
});

function createTempFilesSDKFilesystem(): FilesSDKFilesystem {
  const root = mkdtempSync(join(tmpdir(), 'mastra-files-sdk-'));
  tmpDirs.push(root);
  const files = new Files({ adapter: fsAdapter({ root }) });
  return new FilesSDKFilesystem({ files });
}

createFilesystemTestSuite({
  suiteName: 'FilesSDKFilesystem Conformance (fs adapter)',
  createFilesystem: () => createTempFilesSDKFilesystem(),
  capabilities: {
    supportsAppend: true,
    supportsBinaryFiles: true,
    supportsForceDelete: true,
    supportsOverwrite: true,
    supportsConcurrency: true,
    // FilesSDK is an object-storage abstraction — no first-class directories.
    supportsEmptyDirectories: false,
    // Our deleteFile throws FileNotFoundError on missing keys.
    deleteThrowsOnMissing: true,
    // Mounting (sandbox) is not supported by FilesSDK adapters.
    supportsMounting: false,
  },
  testTimeout: 15000,
});
