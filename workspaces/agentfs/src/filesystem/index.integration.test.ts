/**
 * AgentFS Filesystem Integration Tests
 *
 * Conformance test suite against a real AgentFS SQLite database.
 * No mocks — every test hits the real agentfs-sdk.
 */

import { createFilesystemTestSuite, createWorkspaceIntegrationTests } from '@internal/workspace-test-utils';
import { cleanupCompositeMounts } from '@internal/workspace-test-utils/integration';
import { Workspace } from '@mastra/core/workspace';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { AgentFSFilesystem } from './index';

/**
 * Helper to create a unique agentId per test run.
 */
function uniqueAgentId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Helper to clean up all files in a filesystem root.
 */
async function cleanupFilesystem(fs: AgentFSFilesystem): Promise<void> {
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
}

// ─── Basic Integration Tests ─────────────────────────────────────────────────

describe('AgentFSFilesystem Integration', () => {
  let fs: AgentFSFilesystem;

  beforeEach(() => {
    fs = new AgentFSFilesystem({
      agentId: uniqueAgentId('integration'),
    });
  });

  afterEach(async () => {
    await cleanupFilesystem(fs);
    await fs.destroy();
  });

  it('can write and read files', async () => {
    await fs.init();

    await fs.writeFile('/test.txt', 'Hello AgentFS!');
    const content = await fs.readFile('/test.txt', { encoding: 'utf-8' });

    expect(content).toBe('Hello AgentFS!');
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

  it('can create and list directories', async () => {
    await fs.init();

    await fs.mkdir('/test-dir');
    await fs.writeFile('/test-dir/file.txt', 'nested content');

    const entries = await fs.readdir('/');
    const names = entries.map(e => e.name);
    expect(names).toContain('test-dir');

    const dirEntry = entries.find(e => e.name === 'test-dir');
    expect(dirEntry?.type).toBe('directory');
  });

  it('supports isFile and isDirectory', async () => {
    await fs.init();

    await fs.writeFile('/check.txt', 'content');
    await fs.mkdir('/check-dir');

    expect(await fs.isFile('/check.txt')).toBe(true);
    expect(await fs.isDirectory('/check.txt')).toBe(false);
    expect(await fs.isFile('/check-dir')).toBe(false);
    expect(await fs.isDirectory('/check-dir')).toBe(true);
    expect(await fs.isFile('/nonexistent')).toBe(false);
    expect(await fs.isDirectory('/nonexistent')).toBe(false);
  });
});

// ─── Agent Isolation Tests ───────────────────────────────────────────────────

/**
 * Verifies that two AgentFSFilesystem instances with different agentIds
 * cannot see each other's files — equivalent to S3/GCS prefix isolation.
 */
describe('AgentFSFilesystem Agent Isolation', () => {
  const baseId = uniqueAgentId('isolation');
  let fsA: AgentFSFilesystem;
  let fsB: AgentFSFilesystem;

  beforeEach(async () => {
    fsA = new AgentFSFilesystem({ agentId: `${baseId}-a` });
    fsB = new AgentFSFilesystem({ agentId: `${baseId}-b` });
    await fsA.init();
    await fsB.init();
  });

  afterEach(async () => {
    for (const f of [fsA, fsB]) {
      await cleanupFilesystem(f);
      await f.destroy();
    }
  });

  it('file written via agent A is not visible via agent B', async () => {
    await fsA.writeFile('/isolated.txt', 'only in A');

    expect(await fsA.exists('/isolated.txt')).toBe(true);
    expect(await fsB.exists('/isolated.txt')).toBe(false);
  });

  it('readdir via agent A does not include files from agent B', async () => {
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

  it('delete via agent A does not affect agent B', async () => {
    await fsA.writeFile('/shared-name.txt', 'A version');
    await fsB.writeFile('/shared-name.txt', 'B version');

    await fsA.deleteFile('/shared-name.txt');

    expect(await fsA.exists('/shared-name.txt')).toBe(false);
    expect(await fsB.exists('/shared-name.txt')).toBe(true);

    const content = await fsB.readFile('/shared-name.txt', { encoding: 'utf-8' });
    expect(content).toBe('B version');
  });

  it('stat via agent B fails for file only in agent A', async () => {
    await fsA.writeFile('/only-a.txt', 'A content');

    const statA = await fsA.stat('/only-a.txt');
    expect(statA.type).toBe('file');

    await expect(fsB.stat('/only-a.txt')).rejects.toThrow();
  });
});

// ─── CompositeFilesystem Integration Tests ───────────────────────────────────

/**
 * Verifies CompositeFilesystem behavior with two AgentFS mounts
 * (same provider, different agentIds). No sandbox needed.
 */
createWorkspaceIntegrationTests({
  suiteName: 'AgentFS CompositeFilesystem Integration',
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
    const prefix = uniqueAgentId('cfs');
    return new Workspace({
      mounts: {
        '/mount-a': new AgentFSFilesystem({ agentId: `${prefix}-a` }),
        '/mount-b': new AgentFSFilesystem({ agentId: `${prefix}-b` }),
      },
    });
  },
  cleanupWorkspace: cleanupCompositeMounts,
});

// ─── Shared Conformance Test Suite ───────────────────────────────────────────

createFilesystemTestSuite({
  suiteName: 'AgentFSFilesystem Conformance',
  createFilesystem: () => {
    return new AgentFSFilesystem({
      agentId: uniqueAgentId('conformance'),
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
    supportsForceDelete: true,
    supportsOverwrite: true,
    supportsConcurrency: true,
    supportsEmptyDirectories: true,
    deleteThrowsOnMissing: true,
  },
  testTimeout: 30000,
});
