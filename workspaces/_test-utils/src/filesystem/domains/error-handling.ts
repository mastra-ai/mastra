/**
 * Error handling test domain.
 * Tests: FileNotFoundError, PermissionError, and other error scenarios
 */

import type { WorkspaceFilesystem } from '@mastra/core/workspace';
import { FileNotFoundError, PermissionError } from '@mastra/core/workspace';
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

export function createErrorHandlingTests(getContext: () => TestContext): void {
  describe('Error Handling', () => {
    afterEach(async () => {
      const { cleanup } = getContext();
      await cleanup();
    });

    describe('FileNotFoundError', () => {
      it('throws FileNotFoundError when reading non-existent file', async () => {
        const { fs, getTestPath } = getContext();
        const path = `${getTestPath()}/does-not-exist.txt`;

        await expect(fs.readFile(path)).rejects.toThrow(FileNotFoundError);
      });

      it('throws FileNotFoundError when deleting non-existent file without force', async () => {
        const { fs, getTestPath, capabilities } = getContext();

        // S3's DeleteObject is idempotent - it succeeds for non-existent keys
        if (!capabilities.deleteThrowsOnMissing) return;

        const path = `${getTestPath()}/does-not-exist.txt`;

        await expect(fs.deleteFile(path)).rejects.toThrow(FileNotFoundError);
      });

      it('throws FileNotFoundError when copying non-existent source', async () => {
        const { fs, getTestPath } = getContext();
        const src = `${getTestPath()}/no-source.txt`;
        const dest = `${getTestPath()}/dest.txt`;

        await expect(fs.copyFile(src, dest)).rejects.toThrow(FileNotFoundError);
      });

      it('throws FileNotFoundError when getting stat of non-existent path', async () => {
        const { fs, getTestPath } = getContext();
        const path = `${getTestPath()}/no-stat.txt`;

        await expect(fs.stat(path)).rejects.toThrow(FileNotFoundError);
      });
    });

    describe('PermissionError', () => {
      it('throws PermissionError when writing to readOnly filesystem', async () => {
        const { fs, getTestPath } = getContext();

        // Skip if filesystem is not read-only
        if (!fs.readOnly) return;

        const path = `${getTestPath()}/write-attempt.txt`;

        await expect(fs.writeFile(path, 'content')).rejects.toThrow(PermissionError);
      });

      it('throws PermissionError when deleting from readOnly filesystem', async () => {
        const { fs, getTestPath } = getContext();

        // Skip if filesystem is not read-only
        if (!fs.readOnly) return;

        const path = `${getTestPath()}/delete-attempt.txt`;

        await expect(fs.deleteFile(path)).rejects.toThrow(PermissionError);
      });

      it('throws PermissionError when creating directory on readOnly filesystem', async () => {
        const { fs, getTestPath } = getContext();

        // Skip if filesystem is not read-only
        if (!fs.readOnly) return;

        const path = `${getTestPath()}/new-dir`;

        await expect(fs.mkdir(path)).rejects.toThrow(PermissionError);
      });

      it('allows read operations on readOnly filesystem', async () => {
        const { fs } = getContext();

        // Skip if filesystem is not read-only
        if (!fs.readOnly) return;

        // These operations should work on a read-only filesystem
        // exists() should resolve without error
        await expect(fs.exists('/')).resolves.toBeDefined();

        // readdir() on root should resolve without error
        await expect(fs.readdir('/')).resolves.toBeDefined();

        // readFile() should work if a file exists - use try/catch since
        // the file may not exist on a fresh bucket, but it should not
        // throw PermissionError
        try {
          await fs.readFile('/nonexistent-read-test.txt');
        } catch (error) {
          // Should be FileNotFoundError, NOT PermissionError
          expect(error).not.toBeInstanceOf(PermissionError);
        }
      });
    });

    describe('Directory errors', () => {
      it('throws when removing non-empty directory without recursive', async () => {
        const { fs, getTestPath } = getContext();
        if (fs.readOnly) return;
        const path = `${getTestPath()}/non-empty`;

        // Create directory with a file so it exists on object stores
        await fs.mkdir(path);
        await fs.writeFile(`${path}/file.txt`, 'content');

        await expect(fs.rmdir(path)).rejects.toThrow();
      });

      it('throws when reading directory as file', async () => {
        const { fs, getTestPath, capabilities } = getContext();
        if (fs.readOnly) return;

        // Object stores don't support empty directories
        if (!capabilities.supportsEmptyDirectories) return;

        const path = `${getTestPath()}/a-directory`;

        await fs.mkdir(path);

        // Reading a directory should fail
        await expect(fs.readFile(path)).rejects.toThrow();
      });
    });
  });
}
