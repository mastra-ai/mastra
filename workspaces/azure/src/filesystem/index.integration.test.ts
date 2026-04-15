/**
 * Azure Blob Filesystem Integration Tests
 *
 * These tests run against either:
 * 1. Real Azure (cloud) - requires AZURE_STORAGE_CONNECTION_STRING and TEST_AZURE_CONTAINER
 * 2. Azurite emulator (docker) - requires AZURE_STORAGE_CONNECTION_STRING and TEST_AZURE_CONTAINER
 *
 * Environment variables:
 * - TEST_AZURE_CONTAINER: Container name (required)
 * - AZURE_STORAGE_CONNECTION_STRING: Connection string for Azure or Azurite (required)
 */

import { BlobServiceClient } from '@azure/storage-blob';
import {
  createFilesystemTestSuite,
  createWorkspaceIntegrationTests,
  cleanupCompositeMounts,
} from '@internal/workspace-test-utils';
import { Workspace } from '@mastra/core/workspace';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';

import { AzureBlobFilesystem } from './index';

const hasAzureCredentials = !!(process.env.AZURE_STORAGE_CONNECTION_STRING && process.env.TEST_AZURE_CONTAINER);

/**
 * Ensure the test container exists in Azurite/Azure.
 * Uses the SDK directly instead of requiring the 1GB azure-cli Docker image.
 */
async function ensureTestContainer(): Promise<void> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
  const containerName = process.env.TEST_AZURE_CONTAINER!;
  const serviceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = serviceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists();
}

// Ensure test container exists before any test suite runs
beforeAll(async () => {
  if (hasAzureCredentials) {
    await ensureTestContainer();
  }
});

describe.skipIf(!hasAzureCredentials)('AzureBlobFilesystem Integration', () => {
  const testContainer = process.env.TEST_AZURE_CONTAINER!;
  let fs: AzureBlobFilesystem;
  let testPrefix: string;

  beforeEach(() => {
    testPrefix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    fs = new AzureBlobFilesystem({
      container: testContainer,
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
      prefix: testPrefix,
    });
  });

  afterEach(async () => {
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

    await fs.writeFile('/test.txt', 'Hello Azure!');
    const content = await fs.readFile('/test.txt', { encoding: 'utf-8' });

    expect(content).toBe('Hello Azure!');
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
 * Verifies that two AzureBlobFilesystem instances with different prefixes on the
 * same container cannot see each other's files.
 */
describe.skipIf(!hasAzureCredentials)('AzureBlobFilesystem Prefix Isolation', () => {
  const testContainer = process.env.TEST_AZURE_CONTAINER!;
  const basePrefix = `prefix-iso-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let fsA: AzureBlobFilesystem;
  let fsB: AzureBlobFilesystem;

  beforeEach(() => {
    fsA = new AzureBlobFilesystem({
      container: testContainer,
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
      prefix: `${basePrefix}-a`,
    });
    fsB = new AzureBlobFilesystem({
      container: testContainer,
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
      prefix: `${basePrefix}-b`,
    });
  });

  afterEach(async () => {
    for (const f of [fsA, fsB]) {
      try {
        const files = await f.readdir('/');
        for (const file of files) {
          if (file.type === 'file') await f.deleteFile(`/${file.name}`, { force: true });
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
 */
if (hasAzureCredentials) {
  createWorkspaceIntegrationTests({
    suiteName: 'Azure CompositeFilesystem Integration',
    testTimeout: 30000,
    testScenarios: {
      fileSync: false,
      concurrentOperations: false,
      largeFileHandling: false,
      writeReadConsistency: false,
      mountRouting: true,
      crossMountApi: true,
      virtualDirectory: true,
      mountIsolation: true,
    },
    createWorkspace: () => {
      const testContainer = process.env.TEST_AZURE_CONTAINER!;
      const prefix = `cfs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return new Workspace({
        mounts: {
          '/mount-a': new AzureBlobFilesystem({
            container: testContainer,
            connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
            prefix: `${prefix}-a`,
          }),
          '/mount-b': new AzureBlobFilesystem({
            container: testContainer,
            connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
            prefix: `${prefix}-b`,
          }),
        },
      });
    },
    cleanupWorkspace: cleanupCompositeMounts,
  });
}

if (hasAzureCredentials) {
  createFilesystemTestSuite({
    suiteName: 'AzureBlobFilesystem Conformance',
    createFilesystem: () => {
      const testPrefix = `conformance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return new AzureBlobFilesystem({
        container: process.env.TEST_AZURE_CONTAINER!,
        connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
        prefix: testPrefix,
      });
    },
    cleanupFilesystem: async fs => {
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
      supportsAppend: true,
      supportsBinaryFiles: true,
      supportsMounting: true,
      supportsForceDelete: true,
      supportsOverwrite: true,
      supportsConcurrency: true,
      supportsEmptyDirectories: false,
      deleteThrowsOnMissing: true,
    },
    testTimeout: 30000,
  });
}
