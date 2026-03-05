/**
 * Path operations test domain.
 * Tests: exists, stat
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
 * Helper to check if a path is a file using stat().
 */
async function isFile(fs: WorkspaceFilesystem, path: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path);
    return stat.type === 'file';
  } catch {
    return false;
  }
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

export function createPathOperationsTests(getContext: () => TestContext): void {
  describe('Path Operations', () => {
    afterEach(async () => {
      const { cleanup } = getContext();
      await cleanup();
    });

    describe('exists', () => {
      it('returns true for existing file', async () => {
        const { fs, getTestPath } = getContext();
        const path = `${getTestPath()}/exists-file.txt`;

        await fs.writeFile(path, 'content');

        const exists = await fs.exists(path);
        expect(exists).toBe(true);
      });

      it('returns true for existing directory', async () => {
        const { fs, getTestPath, capabilities } = getContext();

        // Object stores don't support empty directories
        if (!capabilities.supportsEmptyDirectories) return;

        const path = `${getTestPath()}/exists-dir`;

        await fs.mkdir(path);

        const exists = await fs.exists(path);
        expect(exists).toBe(true);
      });

      it('returns false for non-existent path', async () => {
        const { fs, getTestPath } = getContext();
        const path = `${getTestPath()}/does-not-exist`;

        const exists = await fs.exists(path);
        expect(exists).toBe(false);
      });
    });

    describe('stat', () => {
      it('returns file stats', async () => {
        const { fs, getTestPath } = getContext();
        const path = `${getTestPath()}/stat-file.txt`;
        const content = 'Hello, stat!';

        await fs.writeFile(path, content);

        const stat = await fs.stat(path);
        expect(stat.type).toBe('file');
        expect(stat.name).toBe('stat-file.txt');
        expect(stat.path).toContain('stat-file.txt');
        expect(stat.size).toBeGreaterThanOrEqual(content.length);
      });

      it('returns directory stats', async () => {
        const { fs, getTestPath, capabilities } = getContext();

        // Object stores don't support empty directories
        if (!capabilities.supportsEmptyDirectories) return;

        const path = `${getTestPath()}/stat-dir`;

        await fs.mkdir(path);

        const stat = await fs.stat(path);
        expect(stat.type).toBe('directory');
        expect(stat.name).toBe('stat-dir');
      });

      it('includes timestamps', async () => {
        const { fs, getTestPath } = getContext();
        const path = `${getTestPath()}/stat-time.txt`;

        const beforeWrite = new Date();
        await fs.writeFile(path, 'content');

        const stat = await fs.stat(path);

        // Timestamps should be Date objects
        expect(stat.createdAt).toBeInstanceOf(Date);
        expect(stat.modifiedAt).toBeInstanceOf(Date);

        // Modified time should be recent
        expect(stat.modifiedAt.getTime()).toBeGreaterThanOrEqual(beforeWrite.getTime() - 1000);
      });

      it('can determine if path is a file', async () => {
        const { fs, getTestPath } = getContext();
        const path = `${getTestPath()}/is-file.txt`;

        await fs.writeFile(path, 'content');

        expect(await isFile(fs, path)).toBe(true);
        expect(await isDirectory(fs, path)).toBe(false);
      });

      it('can determine if path is a directory', async () => {
        const { fs, getTestPath, capabilities } = getContext();

        // Object stores don't support empty directories
        if (!capabilities.supportsEmptyDirectories) return;

        const path = `${getTestPath()}/is-dir`;

        await fs.mkdir(path);

        expect(await isDirectory(fs, path)).toBe(true);
        expect(await isFile(fs, path)).toBe(false);
      });

      it('handles non-existent paths', async () => {
        const { fs, getTestPath } = getContext();
        const path = `${getTestPath()}/no-such-path`;

        expect(await isFile(fs, path)).toBe(false);
        expect(await isDirectory(fs, path)).toBe(false);
      });
    });
  });
}
