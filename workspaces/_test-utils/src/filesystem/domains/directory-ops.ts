/**
 * Directory operations test domain.
 * Tests: mkdir, rmdir, readdir
 */

import type { WorkspaceFilesystem } from '@mastra/core/workspace';
import { describe, it, expect, afterEach } from 'vitest';

import type { FilesystemCapabilities } from '../types';

interface TestContext {
  fs: WorkspaceFilesystem;
  getTestPath: () => string;
  capabilities: Required<FilesystemCapabilities>;
  testTimeout: number;
  fastOnly: boolean;
  cleanup: () => Promise<void>;
}

/**
 * Helper to check if a path is a directory using stat().
 */
async function isDirectory(fs: WorkspaceFilesystem, path: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path);
    return stat.type === 'directory';
  } catch {
    return false;
  }
}

export function createDirectoryOpsTests(getContext: () => TestContext): void {
  describe('Directory Operations', () => {
    afterEach(async () => {
      const { cleanup } = getContext();
      await cleanup();
    });

    describe('mkdir', () => {
      it('creates a directory', async () => {
        const { fs, getTestPath, capabilities } = getContext();

        // Object stores don't support empty directories - mkdir is a no-op
        if (!capabilities.supportsEmptyDirectories) return;

        const path = `${getTestPath()}/new-dir`;

        await fs.mkdir(path);

        const isDir = await isDirectory(fs, path);
        expect(isDir).toBe(true);
      });

      it('creates nested directories with recursive option', async () => {
        const { fs, getTestPath, capabilities } = getContext();

        // Object stores don't support empty directories
        if (!capabilities.supportsEmptyDirectories) return;

        const path = `${getTestPath()}/a/b/c/d`;

        await fs.mkdir(path, { recursive: true });

        const isDir = await isDirectory(fs, path);
        expect(isDir).toBe(true);
      });

      it('does not throw if directory already exists with recursive', async () => {
        const { fs, getTestPath, capabilities } = getContext();

        // Object stores don't support empty directories
        if (!capabilities.supportsEmptyDirectories) return;

        const path = `${getTestPath()}/existing-dir`;

        await fs.mkdir(path, { recursive: true });
        // Should not throw
        await fs.mkdir(path, { recursive: true });

        const isDir = await isDirectory(fs, path);
        expect(isDir).toBe(true);
      });
    });

    describe('rmdir', () => {
      it('removes empty directory', async () => {
        const { fs, getTestPath, capabilities } = getContext();

        // Object stores don't support empty directories
        if (!capabilities.supportsEmptyDirectories) return;

        const path = `${getTestPath()}/empty-dir`;

        await fs.mkdir(path);
        await fs.rmdir(path);

        const exists = await fs.exists(path);
        expect(exists).toBe(false);
      });

      it('removes directory with contents when recursive', async () => {
        const { fs, getTestPath } = getContext();
        const path = `${getTestPath()}/dir-with-contents`;

        // Create directory with files (works on object stores because files exist)
        await fs.mkdir(path);
        await fs.writeFile(`${path}/file1.txt`, 'content1');
        await fs.writeFile(`${path}/file2.txt`, 'content2');
        await fs.mkdir(`${path}/subdir`);
        await fs.writeFile(`${path}/subdir/file3.txt`, 'content3');

        await fs.rmdir(path, { recursive: true });

        const exists = await fs.exists(path);
        expect(exists).toBe(false);
      });
    });

    describe('readdir', () => {
      it('lists directory contents', async () => {
        const { fs, getTestPath, capabilities } = getContext();
        const path = getTestPath();

        await fs.mkdir(path);
        await fs.writeFile(`${path}/file1.txt`, 'content1');
        await fs.writeFile(`${path}/file2.txt`, 'content2');

        // For object stores, create a file inside subdir so it "exists"
        if (!capabilities.supportsEmptyDirectories) {
          await fs.writeFile(`${path}/subdir/.gitkeep`, '');
        } else {
          await fs.mkdir(`${path}/subdir`);
        }

        const entries = await fs.readdir(path);

        const names = entries.map(e => e.name).sort();
        expect(names).toContain('file1.txt');
        expect(names).toContain('file2.txt');
        expect(names).toContain('subdir');
      });

      it('returns file type for entries', async () => {
        const { fs, getTestPath, capabilities } = getContext();
        const path = getTestPath();

        await fs.mkdir(path);
        await fs.writeFile(`${path}/file.txt`, 'content');

        // For object stores, create a file inside the dir so it "exists"
        if (!capabilities.supportsEmptyDirectories) {
          await fs.writeFile(`${path}/dir/.gitkeep`, '');
        } else {
          await fs.mkdir(`${path}/dir`);
        }

        const entries = await fs.readdir(path);

        const file = entries.find(e => e.name === 'file.txt');
        const dir = entries.find(e => e.name === 'dir');

        expect(file?.type).toBe('file');
        expect(dir?.type).toBe('directory');
      });

      it('returns empty array for empty directory', async () => {
        const { fs, getTestPath, capabilities } = getContext();

        // Object stores don't support empty directories
        if (!capabilities.supportsEmptyDirectories) return;

        const path = `${getTestPath()}/empty`;

        await fs.mkdir(path);

        const entries = await fs.readdir(path);
        expect(entries).toEqual([]);
      });

      it('lists recursively when recursive option is true', async () => {
        const { fs, getTestPath } = getContext();
        const path = getTestPath();

        await fs.mkdir(path);
        await fs.writeFile(`${path}/root.txt`, 'root');
        await fs.mkdir(`${path}/sub`);
        await fs.writeFile(`${path}/sub/nested.txt`, 'nested');

        const entries = await fs.readdir(path, { recursive: true });
        const names = entries.map(e => e.name);

        expect(names).toContain('root.txt');
        // Recursive should include nested paths
        expect(names.some(n => n.includes('nested.txt') || n === 'sub/nested.txt')).toBe(true);
      });

      it('filters by extension when specified', async () => {
        const { fs, getTestPath } = getContext();
        const path = getTestPath();

        await fs.mkdir(path);
        await fs.writeFile(`${path}/file.txt`, 'text');
        await fs.writeFile(`${path}/file.md`, 'markdown');
        await fs.writeFile(`${path}/file.json`, '{}');

        const entries = await fs.readdir(path, { extension: '.txt' });
        const names = entries.map(e => e.name);

        expect(names).toContain('file.txt');
        expect(names).not.toContain('file.md');
        expect(names).not.toContain('file.json');
      });
    });
  });
}
