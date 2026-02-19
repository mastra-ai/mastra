/**
 * File operations test domain.
 * Tests: readFile, writeFile, appendFile, deleteFile, copyFile, moveFile
 */

import type { WorkspaceFilesystem } from '@mastra/core/workspace';
import { describe, it, expect, afterEach } from 'vitest';

import { generateTextContent, generateBinaryContent } from '../../test-helpers';
import type { FilesystemCapabilities } from '../types';

interface TestContext {
  fs: WorkspaceFilesystem;
  getTestPath: () => string;
  capabilities: Required<FilesystemCapabilities>;
  testTimeout: number;
  fastOnly: boolean;
  cleanup: () => Promise<void>;
}

export function createFileOperationsTests(getContext: () => TestContext): void {
  describe('File Operations', () => {
    afterEach(async () => {
      const { cleanup } = getContext();
      await cleanup();
    });

    describe('writeFile', () => {
      it('writes text content', async () => {
        const { fs, getTestPath } = getContext();
        const path = `${getTestPath()}/text-file.txt`;
        const content = 'Hello, World!';

        await fs.writeFile(path, content);

        const result = await fs.readFile(path, { encoding: 'utf-8' });
        expect(result).toBe(content);
      });

      it('writes binary content', async () => {
        const { fs, getTestPath, capabilities } = getContext();
        if (!capabilities.supportsBinaryFiles) return;

        const path = `${getTestPath()}/binary-file.bin`;
        const content = generateBinaryContent(256);

        await fs.writeFile(path, content);

        const result = await fs.readFile(path);
        expect(result).toBeInstanceOf(Buffer);
        expect(Buffer.from(result as Buffer).equals(content)).toBe(true);
      });

      it('creates parent directories if needed', async () => {
        const { fs, getTestPath } = getContext();
        const path = `${getTestPath()}/nested/deep/file.txt`;
        const content = 'nested content';

        await fs.writeFile(path, content);

        const result = await fs.readFile(path, { encoding: 'utf-8' });
        expect(result).toBe(content);
      });

      it('overwrites existing file', async () => {
        const { fs, getTestPath } = getContext();
        const path = `${getTestPath()}/overwrite.txt`;

        await fs.writeFile(path, 'original');
        await fs.writeFile(path, 'updated');

        const result = await fs.readFile(path, { encoding: 'utf-8' });
        expect(result).toBe('updated');
      });

      it('handles empty content', async () => {
        const { fs, getTestPath } = getContext();
        const path = `${getTestPath()}/empty.txt`;

        await fs.writeFile(path, '');

        const result = await fs.readFile(path, { encoding: 'utf-8' });
        expect(result).toBe('');
      });

      it('handles unicode content', async () => {
        const { fs, getTestPath } = getContext();
        const path = `${getTestPath()}/unicode.txt`;
        const content = '你好世界 🌍 مرحبا';

        await fs.writeFile(path, content);

        const result = await fs.readFile(path, { encoding: 'utf-8' });
        expect(result).toBe(content);
      });

      it('writes with recursive option to create parent dirs', async () => {
        const { fs, getTestPath } = getContext();
        const path = `${getTestPath()}/deeply/nested/path/file.txt`;
        const content = 'content in nested path';

        // Write with recursive option
        await fs.writeFile(path, content, { recursive: true });

        const result = await fs.readFile(path, { encoding: 'utf-8' });
        expect(result).toBe(content);
      });

      it('writes with encoding option', async () => {
        const { fs, getTestPath } = getContext();
        const path = `${getTestPath()}/encoded-write.txt`;
        const content = 'Encoded content: äöü';

        await fs.writeFile(path, content, { encoding: 'utf-8' });

        const result = await fs.readFile(path, { encoding: 'utf-8' });
        expect(result).toBe(content);
      });

      it('writes Buffer content', async () => {
        const { fs, getTestPath, capabilities } = getContext();
        if (!capabilities.supportsBinaryFiles) return;

        const path = `${getTestPath()}/buffer-write.bin`;
        const content = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello" in bytes

        await fs.writeFile(path, content);

        const result = await fs.readFile(path);
        expect(Buffer.from(result as Buffer).equals(content)).toBe(true);
      });
    });

    describe('readFile', () => {
      it('reads text file with encoding', async () => {
        const { fs, getTestPath } = getContext();
        const path = `${getTestPath()}/read-text.txt`;
        const content = 'Read me!';

        await fs.writeFile(path, content);

        const result = await fs.readFile(path, { encoding: 'utf-8' });
        expect(typeof result).toBe('string');
        expect(result).toBe(content);
      });

      it('reads binary file without encoding', async () => {
        const { fs, getTestPath, capabilities } = getContext();
        if (!capabilities.supportsBinaryFiles) return;

        const path = `${getTestPath()}/read-binary.bin`;
        const content = generateBinaryContent(128);

        await fs.writeFile(path, content);

        const result = await fs.readFile(path);
        expect(result).toBeInstanceOf(Buffer);
      });
    });

    describe('appendFile', () => {
      it('appends to existing file', async () => {
        const { fs, getTestPath, capabilities } = getContext();
        if (!capabilities.supportsAppend) return;

        const path = `${getTestPath()}/append.txt`;

        await fs.writeFile(path, 'Hello');
        await fs.appendFile(path, ', World!');

        const result = await fs.readFile(path, { encoding: 'utf-8' });
        expect(result).toBe('Hello, World!');
      });

      it('creates file if not exists', async () => {
        const { fs, getTestPath, capabilities } = getContext();
        if (!capabilities.supportsAppend) return;

        const path = `${getTestPath()}/append-new.txt`;

        await fs.appendFile(path, 'New content');

        const result = await fs.readFile(path, { encoding: 'utf-8' });
        expect(result).toBe('New content');
      });
    });

    describe('deleteFile', () => {
      it('deletes existing file', async () => {
        const { fs, getTestPath } = getContext();
        const path = `${getTestPath()}/delete-me.txt`;

        await fs.writeFile(path, 'delete me');
        await fs.deleteFile(path);

        const exists = await fs.exists(path);
        expect(exists).toBe(false);
      });

      it('succeeds with force option for missing file', async () => {
        const { fs, getTestPath, capabilities } = getContext();
        if (!capabilities.supportsForceDelete) return;

        const path = `${getTestPath()}/nonexistent.txt`;

        // Should not throw with force option
        await fs.deleteFile(path, { force: true });
      });
    });

    describe('copyFile', () => {
      it('copies file to new location', async () => {
        const { fs, getTestPath } = getContext();
        const src = `${getTestPath()}/copy-src.txt`;
        const dest = `${getTestPath()}/copy-dest.txt`;
        const content = 'Copy me!';

        await fs.writeFile(src, content);
        await fs.copyFile(src, dest);

        const srcContent = await fs.readFile(src, { encoding: 'utf-8' });
        const destContent = await fs.readFile(dest, { encoding: 'utf-8' });
        expect(srcContent).toBe(content);
        expect(destContent).toBe(content);
      });

      it('overwrites with overwrite option', async () => {
        const { fs, getTestPath, capabilities } = getContext();
        if (!capabilities.supportsOverwrite) return;

        const src = `${getTestPath()}/copy-src2.txt`;
        const dest = `${getTestPath()}/copy-dest2.txt`;

        await fs.writeFile(src, 'source');
        await fs.writeFile(dest, 'original');
        await fs.copyFile(src, dest, { overwrite: true });

        const destContent = await fs.readFile(dest, { encoding: 'utf-8' });
        expect(destContent).toBe('source');
      });

      it('rejects copy with overwrite: false when dest exists', async () => {
        const { fs, getTestPath, capabilities } = getContext();
        if (!capabilities.supportsOverwrite) return;

        const src = `${getTestPath()}/copy-no-overwrite-src.txt`;
        const dest = `${getTestPath()}/copy-no-overwrite-dest.txt`;

        await fs.writeFile(src, 'source');
        await fs.writeFile(dest, 'original');

        await expect(fs.copyFile(src, dest, { overwrite: false })).rejects.toThrow();

        // Dest should be unchanged
        const destContent = await fs.readFile(dest, { encoding: 'utf-8' });
        expect(destContent).toBe('original');
      });
    });

    describe('moveFile', () => {
      it('moves file to new location', async () => {
        const { fs, getTestPath } = getContext();
        const src = `${getTestPath()}/move-src.txt`;
        const dest = `${getTestPath()}/move-dest.txt`;
        const content = 'Move me!';

        await fs.writeFile(src, content);
        await fs.moveFile(src, dest);

        const srcExists = await fs.exists(src);
        const destContent = await fs.readFile(dest, { encoding: 'utf-8' });
        expect(srcExists).toBe(false);
        expect(destContent).toBe(content);
      });

      it('moves to different directory', async () => {
        const { fs, getTestPath } = getContext();
        const src = `${getTestPath()}/dir1/file.txt`;
        const dest = `${getTestPath()}/dir2/file.txt`;
        const content = 'Move across dirs!';

        await fs.writeFile(src, content);
        await fs.moveFile(src, dest);

        const srcExists = await fs.exists(src);
        const destContent = await fs.readFile(dest, { encoding: 'utf-8' });
        expect(srcExists).toBe(false);
        expect(destContent).toBe(content);
      });
    });

    describe('large files', () => {
      it('handles moderately large file', async () => {
        const { fs, getTestPath, capabilities, fastOnly, testTimeout } = getContext();
        if (fastOnly) return;

        const size = Math.min(1024 * 1024, capabilities.maxTestFileSize); // 1MB or max
        const path = `${getTestPath()}/large-file.txt`;
        const content = generateTextContent(size);

        await fs.writeFile(path, content);

        const result = await fs.readFile(path, { encoding: 'utf-8' });
        expect(result.length).toBe(size);
      }, 30000);
    });
  });
}
