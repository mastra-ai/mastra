/**
 * GCS Filesystem Integration Tests
 *
 * These tests run against either:
 * 1. Real GCS (cloud) - requires GCS_SERVICE_ACCOUNT_KEY and TEST_GCS_BUCKET
 * 2. Fake GCS emulator (docker) - requires GCS_ENDPOINT and TEST_GCS_BUCKET
 *
 * Environment variables:
 * - TEST_GCS_BUCKET: Bucket name (required)
 * - GCS_SERVICE_ACCOUNT_KEY: JSON service account key for cloud (optional)
 * - GCS_ENDPOINT: Endpoint URL for fake-gcs emulator (optional)
 */

import {
  createFilesystemTestSuite,
  createWorkspaceIntegrationTests,
  cleanupCompositeMounts,
} from '@internal/workspace-test-utils';
import { LocalSandbox, Workspace } from '@mastra/core/workspace';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { GCSFilesystem } from './index';

/**
 * Check if we have GCS credentials (cloud) or emulator endpoint (docker).
 */
const hasGCSCloudCredentials = !!(process.env.GCS_SERVICE_ACCOUNT_KEY && process.env.TEST_GCS_BUCKET);
const hasGCSEmulator = !!(process.env.GCS_ENDPOINT && process.env.TEST_GCS_BUCKET);
const canRunGCSTests = hasGCSCloudCredentials || hasGCSEmulator;

describe.skipIf(!canRunGCSTests)('GCSFilesystem Integration', () => {
  const testBucket = process.env.TEST_GCS_BUCKET!;
  let fs: GCSFilesystem;
  let testPrefix: string;

  beforeEach(() => {
    testPrefix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // For cloud, use service account credentials
    // For emulator, credentials are not needed but endpoint must be set
    const credentials = process.env.GCS_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.GCS_SERVICE_ACCOUNT_KEY)
      : undefined;

    fs = new GCSFilesystem({
      bucket: testBucket,
      credentials,
      prefix: testPrefix,
      endpoint: process.env.GCS_ENDPOINT,
    });
  });

  afterEach(async () => {
    // Cleanup: delete all files with our test prefix
    try {
      const files = await fs.readdir('/');
      for (const file of files) {
        if (file.type === 'file') {
          await fs.deleteFile(`/${file.name}`, { force: true });
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  it('can write and read files', async () => {
    await fs.init();

    await fs.writeFile('/test.txt', 'Hello GCS!');
    const content = await fs.readFile('/test.txt', { encoding: 'utf-8' });

    expect(content).toBe('Hello GCS!');
  });

  it('can check file existence', async () => {
    await fs.init();

    expect(await fs.exists('/nonexistent.txt')).toBe(false);

    await fs.writeFile('/exists.txt', 'I exist');
    expect(await fs.exists('/exists.txt')).toBe(true);
  });

  it('can delete files', async () => {
    await fs.init();

    await fs.writeFile('/to-delete.txt', 'Delete me');
    expect(await fs.exists('/to-delete.txt')).toBe(true);

    await fs.deleteFile('/to-delete.txt');
    expect(await fs.exists('/to-delete.txt')).toBe(false);
  });

  it('can list files', async () => {
    await fs.init();

    await fs.writeFile('/file1.txt', 'Content 1');
    await fs.writeFile('/file2.txt', 'Content 2');

    const files = await fs.readdir('/');
    const names = files.map(f => f.name);

    expect(names).toContain('file1.txt');
    expect(names).toContain('file2.txt');
  });

  it('can copy files', async () => {
    await fs.init();

    await fs.writeFile('/original.txt', 'Original content');
    await fs.copyFile('/original.txt', '/copied.txt');

    const content = await fs.readFile('/copied.txt', { encoding: 'utf-8' });
    expect(content).toBe('Original content');
  });

  it('can move files', async () => {
    await fs.init();

    await fs.writeFile('/source.txt', 'Move me');
    await fs.moveFile('/source.txt', '/destination.txt');

    expect(await fs.exists('/source.txt')).toBe(false);
    expect(await fs.exists('/destination.txt')).toBe(true);

    const content = await fs.readFile('/destination.txt', { encoding: 'utf-8' });
    expect(content).toBe('Move me');
  });

  it('can get file stats', async () => {
    await fs.init();

    await fs.writeFile('/stats.txt', 'Some content');
    const stat = await fs.stat('/stats.txt');

    expect(stat.name).toBe('stats.txt');
    expect(stat.type).toBe('file');
    expect(stat.size).toBeGreaterThan(0);
  });
});

/**
 * Prefix Isolation Tests
 *
 * Verifies that two GCSFilesystem instances with different prefixes on the
 * same bucket cannot see each other's files.
 */
describe.skipIf(!canRunGCSTests)('GCSFilesystem Prefix Isolation', () => {
  const testBucket = process.env.TEST_GCS_BUCKET!;
  const basePrefix = `prefix-iso-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let fsA: GCSFilesystem;
  let fsB: GCSFilesystem;

  beforeEach(() => {
    const credentials = process.env.GCS_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.GCS_SERVICE_ACCOUNT_KEY)
      : undefined;
    fsA = new GCSFilesystem({
      bucket: testBucket,
      credentials,
      prefix: `${basePrefix}-a`,
      endpoint: process.env.GCS_ENDPOINT,
    });
    fsB = new GCSFilesystem({
      bucket: testBucket,
      credentials,
      prefix: `${basePrefix}-b`,
      endpoint: process.env.GCS_ENDPOINT,
    });
  });

  afterEach(async () => {
    for (const fs of [fsA, fsB]) {
      try {
        const files = await fs.readdir('/');
        for (const file of files) {
          if (file.type === 'file') await fs.deleteFile(`/${file.name}`, { force: true });
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('file written via prefix A is not visible via prefix B', async () => {
    await fsA.writeFile('/isolated.txt', 'only in A');

    expect(await fsA.exists('/isolated.txt')).toBe(true);
    expect(await fsB.exists('/isolated.txt')).toBe(false);
  });

  it('readdir via prefix A does not include files from prefix B', async () => {
    await fsA.writeFile('/a-file.txt', 'A content');
    await fsB.writeFile('/b-file.txt', 'B content');

    const entriesA = await fsA.readdir('/');
    const namesA = entriesA.map(e => e.name);
    expect(namesA).toContain('a-file.txt');
    expect(namesA).not.toContain('b-file.txt');

    const entriesB = await fsB.readdir('/');
    const namesB = entriesB.map(e => e.name);
    expect(namesB).toContain('b-file.txt');
    expect(namesB).not.toContain('a-file.txt');
  });

  it('delete via prefix A does not affect prefix B', async () => {
    await fsA.writeFile('/shared-name.txt', 'A version');
    await fsB.writeFile('/shared-name.txt', 'B version');

    await fsA.deleteFile('/shared-name.txt');

    expect(await fsA.exists('/shared-name.txt')).toBe(false);
    expect(await fsB.exists('/shared-name.txt')).toBe(true);

    const content = await fsB.readFile('/shared-name.txt', { encoding: 'utf-8' });
    expect(content).toBe('B version');
  });

  it('stat via prefix B fails for file only in prefix A', async () => {
    await fsA.writeFile('/only-a.txt', 'A content');

    const statA = await fsA.stat('/only-a.txt');
    expect(statA.type).toBe('file');

    await expect(fsB.stat('/only-a.txt')).rejects.toThrow();
  });
});

/**
 * CompositeFilesystem Integration Tests
 *
 * These tests verify CompositeFilesystem behavior with two GCS mounts
 * (same provider, different prefixes) plus LSP diagnostics via LocalSandbox.
 *
 * Sandbox-dependent file tests (fileSync, etc.) are off because LocalSandbox
 * can't read GCS files directly. LSP works because content is sent via protocol.
 */
if (canRunGCSTests) {
  createWorkspaceIntegrationTests({
    suiteName: 'GCS CompositeFilesystem Integration',
    testTimeout: 30000,
    sandboxPathsAligned: false,
    testScenarios: {
      // Sandbox file tests off (LocalSandbox can't see GCS files on disk)
      fileSync: false,
      // API-only scenarios
      concurrentOperations: true,
      largeFileHandling: false,
      writeReadConsistency: true,
      // Composite API scenarios
      mountRouting: true,
      crossMountApi: true,
      virtualDirectory: true,
      mountIsolation: true,
    },
    createWorkspace: () => {
      const testBucket = process.env.TEST_GCS_BUCKET!;
      const credentials = process.env.GCS_SERVICE_ACCOUNT_KEY
        ? JSON.parse(process.env.GCS_SERVICE_ACCOUNT_KEY)
        : undefined;
      const prefix = `cfs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return new Workspace({
        sandbox: new LocalSandbox({ env: process.env }),
        lsp: { diagnosticTimeout: 10000 },
        mounts: {
          '/mount-a': new GCSFilesystem({
            bucket: testBucket,
            credentials,
            prefix: `${prefix}-a`,
            endpoint: process.env.GCS_ENDPOINT,
          }),
          '/mount-b': new GCSFilesystem({
            bucket: testBucket,
            credentials,
            prefix: `${prefix}-b`,
            endpoint: process.env.GCS_ENDPOINT,
          }),
        },
      });
    },
    cleanupWorkspace: cleanupCompositeMounts,
  });
}

/**
 * Direct GCS Filesystem + LSP Integration Tests
 *
 * Tests LSP diagnostics with GCS as the primary (non-mounted) filesystem.
 * Validates that walkUpAsync works directly with GCSFilesystem.exists().
 */
if (canRunGCSTests) {
  createWorkspaceIntegrationTests({
    suiteName: 'GCS Direct Filesystem Integration',
    testTimeout: 30000,
    sandboxPathsAligned: false,
    testScenarios: {
      fileSync: false,
      writeReadConsistency: true,
      concurrentOperations: true,
    },
    createWorkspace: () => {
      const testBucket = process.env.TEST_GCS_BUCKET!;
      const credentials = process.env.GCS_SERVICE_ACCOUNT_KEY
        ? JSON.parse(process.env.GCS_SERVICE_ACCOUNT_KEY)
        : undefined;
      const prefix = `lsp-direct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return new Workspace({
        filesystem: new GCSFilesystem({
          bucket: testBucket,
          credentials,
          prefix,
          endpoint: process.env.GCS_ENDPOINT,
        }),
        sandbox: new LocalSandbox({ env: process.env }),
        lsp: { diagnosticTimeout: 10000 },
      });
    },
    cleanupWorkspace: async workspace => {
      const fs = workspace.filesystem;
      if (!fs) return;
      try {
        const files = await fs.readdir('/');
        for (const file of files) {
          if (file.type === 'file') await fs.deleteFile(`/${file.name}`, { force: true });
          else if (file.type === 'directory') await fs.rmdir(`/${file.name}`, { recursive: true });
        }
      } catch {
        // Ignore cleanup errors
      }
    },
  });
}

if (canRunGCSTests) {
  createFilesystemTestSuite({
    suiteName: 'GCSFilesystem Conformance',
    createFilesystem: () => {
      const credentials = process.env.GCS_SERVICE_ACCOUNT_KEY
        ? JSON.parse(process.env.GCS_SERVICE_ACCOUNT_KEY)
        : undefined;
      const testPrefix = `conformance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return new GCSFilesystem({
        bucket: process.env.TEST_GCS_BUCKET!,
        credentials,
        prefix: testPrefix,
        endpoint: process.env.GCS_ENDPOINT,
      });
    },
    cleanupFilesystem: async fs => {
      // Cleanup test files
      try {
        const files = await fs.readdir('/');
        for (const file of files) {
          if (file.type === 'file') {
            await fs.deleteFile(`/${file.name}`, { force: true });
          } else if (file.type === 'directory') {
            await fs.rmdir(`/${file.name}`, { recursive: true });
          }
        }
      } catch {
        // Ignore cleanup errors
      }
    },
    capabilities: {
      supportsAppend: true, // GCS simulates append via read-modify-write
      supportsBinaryFiles: true,
      supportsMounting: true,
      supportsForceDelete: true,
      supportsOverwrite: true,
      supportsConcurrency: true,
      // Object store limitations
      supportsEmptyDirectories: false, // GCS directories only exist when they contain files
      deleteThrowsOnMissing: true, // GCS throws 404 for missing files
    },
    testTimeout: 30000, // GCS operations can be slow
  });
}
