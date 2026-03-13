/**
 * S3 Filesystem Integration Tests
 *
 * These tests require real S3-compatible credentials and run against
 * actual cloud storage (AWS S3, Cloudflare R2, MinIO, etc.)
 *
 * Required environment variables:
 * - S3_BUCKET: Bucket name
 * - S3_ACCESS_KEY_ID: Access key
 * - S3_SECRET_ACCESS_KEY: Secret key
 * - S3_REGION: Region (optional, defaults to 'auto')
 * - S3_ENDPOINT: Endpoint URL (optional, for R2/MinIO)
 */

import {
  createFilesystemTestSuite,
  createWorkspaceIntegrationTests,
  cleanupCompositeMounts,
} from '@internal/workspace-test-utils';
import { Workspace } from '@mastra/core/workspace';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { S3Filesystem } from './index';

/**
 * Check if we have S3-compatible credentials.
 */
const hasS3Credentials = !!(process.env.S3_ACCESS_KEY_ID && process.env.S3_BUCKET);

/**
 * Get S3 test configuration from environment.
 */
function getS3TestConfig() {
  return {
    bucket: process.env.S3_BUCKET!,
    region: process.env.S3_REGION || 'auto',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    endpoint: process.env.S3_ENDPOINT,
  };
}

describe.skipIf(!hasS3Credentials)('S3Filesystem Integration', () => {
  const config = getS3TestConfig();
  let fs: S3Filesystem;
  let testPrefix: string;

  beforeEach(() => {
    testPrefix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    fs = new S3Filesystem({
      ...config,
      prefix: testPrefix,
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

  it('creates client lazily on first operation', async () => {
    // Client should not be created until we do an operation
    const exists = await fs.exists('/test.txt');
    expect(exists).toBe(false);
  });

  it('can write and read files', async () => {
    await fs.init();

    await fs.writeFile('/test.txt', 'Hello S3!');
    const content = await fs.readFile('/test.txt', { encoding: 'utf-8' });

    expect(content).toBe('Hello S3!');
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

  it('can append to files', async () => {
    await fs.init();

    await fs.writeFile('/append.txt', 'Hello');
    await fs.appendFile('/append.txt', ' World');

    const content = await fs.readFile('/append.txt', { encoding: 'utf-8' });
    expect(content).toBe('Hello World');
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
 * Verifies that two S3Filesystem instances with different prefixes on the
 * same bucket cannot see each other's files.
 */
describe.skipIf(!hasS3Credentials)('S3Filesystem Prefix Isolation', () => {
  const config = getS3TestConfig();
  const basePrefix = `prefix-iso-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let fsA: S3Filesystem;
  let fsB: S3Filesystem;

  beforeEach(() => {
    fsA = new S3Filesystem({ ...config, prefix: `${basePrefix}-a` });
    fsB = new S3Filesystem({ ...config, prefix: `${basePrefix}-b` });
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
 * Workspace BM25 Search + S3 Integration Tests
 *
 * Verifies that workspace BM25 search works when backed by S3Filesystem.
 * Tests auto-indexing and search with and without skills configured.
 */
describe.skipIf(!hasS3Credentials)('S3 Workspace BM25 Search', () => {
  const config = getS3TestConfig();
  let testPrefix: string;
  let s3Fs: S3Filesystem;

  /** Create a SKILL.md with valid frontmatter */
  function skillContent(name: string, description: string): string {
    return `---\nname: ${name}\ndescription: ${description}\n---\n\nInstructions for the ${name} skill. This skill helps with ${description}.\n`;
  }

  beforeEach(async () => {
    testPrefix = `search-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    s3Fs = new S3Filesystem({ ...config, prefix: testPrefix });
    await s3Fs.init();

    // Create test content
    await s3Fs.writeFile(
      '/guides/london/activities.md',
      'London has many activities including visiting the Tower of London and Big Ben',
    );
    await s3Fs.writeFile(
      '/guides/tokyo/activities.md',
      'Tokyo offers amazing experiences like visiting Shibuya crossing and Senso-ji temple',
    );
    await s3Fs.writeFile('/guides/overview.txt', 'A travel guide covering major cities worldwide');

    // Create skills
    await s3Fs.writeFile(
      '/skills/travel-tips/SKILL.md',
      skillContent('travel-tips', 'providing travel tips and recommendations'),
    );
    await s3Fs.writeFile(
      '/skills/language-helper/SKILL.md',
      skillContent('language-helper', 'translating common phrases'),
    );
  });

  afterEach(async () => {
    try {
      // Recursive cleanup of all test files
      const cleanupDir = async (dir: string) => {
        const entries = await s3Fs.readdir(dir);
        for (const entry of entries) {
          const entryPath = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;
          if (entry.type === 'directory') {
            await cleanupDir(entryPath);
          } else {
            await s3Fs.deleteFile(entryPath, { force: true });
          }
        }
      };
      await cleanupDir('/');
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should auto-index and search S3 files with plain autoIndexPaths', async () => {
    const workspace = new Workspace({
      filesystem: s3Fs,
      bm25: true,
      autoIndexPaths: ['/guides'],
    });

    await workspace.init();

    const results = await workspace.search('London');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.id.includes('london'))).toBe(true);

    await workspace.destroy();
  });

  it('should auto-index and search S3 files with glob autoIndexPaths', async () => {
    const workspace = new Workspace({
      filesystem: s3Fs,
      bm25: true,
      autoIndexPaths: ['/guides/**/*.md'],
    });

    await workspace.init();

    const results = await workspace.search('London');
    expect(results.length).toBeGreaterThan(0);

    // Glob should exclude .txt files
    const overviewResults = await workspace.search('travel guide worldwide');
    expect(overviewResults.every(r => r.id.endsWith('.md'))).toBe(true);

    await workspace.destroy();
  });

  it('should search S3 files with skills configured', async () => {
    const workspace = new Workspace({
      filesystem: s3Fs,
      bm25: true,
      autoIndexPaths: ['/guides'],
      skills: ['/skills'],
    });

    await workspace.init();

    const results = await workspace.search('London');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.id.includes('london'))).toBe(true);

    await workspace.destroy();
  });

  it('should preserve S3 search results after skills.refresh()', async () => {
    const workspace = new Workspace({
      filesystem: s3Fs,
      bm25: true,
      autoIndexPaths: ['/guides'],
      skills: ['/skills'],
    });

    await workspace.init();

    const resultsBefore = await workspace.search('London');
    expect(resultsBefore.length).toBeGreaterThan(0);

    // Trigger skills refresh
    await workspace.skills!.refresh();

    // Search should STILL work
    const resultsAfter = await workspace.search('London');
    expect(resultsAfter.length).toBeGreaterThan(0);
    expect(resultsAfter.some(r => r.id.includes('london'))).toBe(true);

    await workspace.destroy();
  });
});

/**
 * CompositeFilesystem Integration Tests
 *
 * These tests verify CompositeFilesystem behavior with two S3 mounts
 * (same provider, different prefixes). No sandbox needed.
 */
if (hasS3Credentials) {
  createWorkspaceIntegrationTests({
    suiteName: 'S3 CompositeFilesystem Integration',
    testTimeout: 30000,
    testScenarios: {
      // Sandbox scenarios off (no sandbox)
      fileSync: false,
      concurrentOperations: false,
      largeFileHandling: false,
      writeReadConsistency: false,
      // Composite API scenarios on
      mountRouting: true,
      crossMountApi: true,
      virtualDirectory: true,
      mountIsolation: true,
    },
    createWorkspace: () => {
      const config = getS3TestConfig();
      const prefix = `cfs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return new Workspace({
        mounts: {
          '/mount-a': new S3Filesystem({ ...config, prefix: `${prefix}-a` }),
          '/mount-b': new S3Filesystem({ ...config, prefix: `${prefix}-b` }),
        },
      });
    },
    cleanupWorkspace: cleanupCompositeMounts,
  });
}

if (hasS3Credentials) {
  createFilesystemTestSuite({
    suiteName: 'S3Filesystem Conformance',
    createFilesystem: () => {
      const config = getS3TestConfig();
      const testPrefix = `conformance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return new S3Filesystem({
        ...config,
        prefix: testPrefix,
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
      supportsAppend: true, // S3 simulates append via read-modify-write
      supportsBinaryFiles: true,
      supportsMounting: true,
      supportsForceDelete: true,
      supportsOverwrite: true,
      supportsConcurrency: true,
      // Object store limitations
      supportsEmptyDirectories: false, // S3 directories only exist when they contain files
      deleteThrowsOnMissing: false, // S3 DeleteObject is idempotent
    },
    testTimeout: 30000, // S3 operations can be slow
  });
}
