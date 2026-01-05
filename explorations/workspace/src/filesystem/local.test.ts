import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import { createLocalFilesystem } from './factory';
import type { WorkspaceFilesystem } from './types';
import {
  FileNotFoundError,
  DirectoryNotFoundError,
  IsDirectoryError,
  PermissionError,
} from './types';

describe('LocalFilesystem', () => {
  let localFs: WorkspaceFilesystem;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'localfs-test-'));
    localFs = createLocalFilesystem({
      id: 'test-local-fs',
      basePath: tempDir,
      sandbox: true,
    });
    await localFs.init?.();
  });

  afterEach(async () => {
    await localFs.destroy?.();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('writeFile and readFile', () => {
    it('should write and read a text file', async () => {
      await localFs.writeFile('/test.txt', 'Hello, Local!');
      const content = await localFs.readFile('/test.txt', { encoding: 'utf-8' });
      expect(content).toBe('Hello, Local!');
    });

    it('should write and read a binary file', async () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      await localFs.writeFile('/test.bin', buffer);
      const content = await localFs.readFile('/test.bin');
      expect(Buffer.isBuffer(content)).toBe(true);
      expect(content).toEqual(buffer);
    });

    it('should persist to disk', async () => {
      await localFs.writeFile('/persistent.txt', 'Hello from disk!');

      // Read directly from disk
      const diskContent = await fs.readFile(
        path.join(tempDir, 'persistent.txt'),
        'utf-8',
      );
      expect(diskContent).toBe('Hello from disk!');
    });

    it('should read files already on disk', async () => {
      // Write directly to disk
      await fs.writeFile(path.join(tempDir, 'existing.txt'), 'Already here');

      // Read through localFs
      const content = await localFs.readFile('/existing.txt', { encoding: 'utf-8' });
      expect(content).toBe('Already here');
    });

    it('should create parent directories', async () => {
      await localFs.writeFile('/deep/nested/path/file.txt', 'deep content');
      const content = await localFs.readFile('/deep/nested/path/file.txt', {
        encoding: 'utf-8',
      });
      expect(content).toBe('deep content');
    });

    it('should throw FileNotFoundError for non-existent file', async () => {
      await expect(localFs.readFile('/nonexistent.txt')).rejects.toThrow(
        FileNotFoundError,
      );
    });

    it('should throw IsDirectoryError when reading a directory', async () => {
      await localFs.mkdir('/testdir');
      await expect(localFs.readFile('/testdir')).rejects.toThrow(IsDirectoryError);
    });
  });

  describe('sandbox security', () => {
    it('should prevent path traversal attacks', async () => {
      await expect(localFs.readFile('../../../etc/passwd')).rejects.toThrow(
        PermissionError,
      );
    });

    it('should prevent absolute path access outside sandbox', async () => {
      await expect(localFs.readFile('/etc/passwd')).rejects.toThrow(
        FileNotFoundError, // File doesn't exist in sandbox
      );
    });

    it('should handle normalized path traversal', async () => {
      await expect(
        localFs.readFile('/foo/bar/../../../etc/passwd'),
      ).rejects.toThrow(PermissionError);
    });
  });

  describe('directory operations', () => {
    it('should create and list directories', async () => {
      await localFs.mkdir('/mydir');
      await localFs.writeFile('/mydir/file1.txt', 'content1');
      await localFs.writeFile('/mydir/file2.txt', 'content2');

      const entries = await localFs.readdir('/mydir');
      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.name).sort()).toEqual(['file1.txt', 'file2.txt']);
    });

    it('should check existence', async () => {
      await localFs.writeFile('/exists.txt', 'content');
      expect(await localFs.exists('/exists.txt')).toBe(true);
      expect(await localFs.exists('/not-exists.txt')).toBe(false);
    });

    it('should get file stats', async () => {
      await localFs.writeFile('/test.txt', 'Hello, World!');
      const stat = await localFs.stat('/test.txt');

      expect(stat.name).toBe('test.txt');
      expect(stat.type).toBe('file');
      expect(stat.size).toBe(13);
      expect(stat.mimeType).toBe('text/plain');
    });
  });

  describe('copy and move', () => {
    it('should copy a file', async () => {
      await localFs.writeFile('/source.txt', 'content');
      await localFs.copyFile('/source.txt', '/dest.txt');

      const content = await localFs.readFile('/dest.txt', { encoding: 'utf-8' });
      expect(content).toBe('content');
      expect(await localFs.exists('/source.txt')).toBe(true);
    });

    it('should move a file', async () => {
      await localFs.writeFile('/source.txt', 'content');
      await localFs.moveFile('/source.txt', '/dest.txt');

      const content = await localFs.readFile('/dest.txt', { encoding: 'utf-8' });
      expect(content).toBe('content');
      expect(await localFs.exists('/source.txt')).toBe(false);
    });
  });

  describe('interface contract', () => {
    it('should have required interface properties', () => {
      expect(localFs.id).toBe('test-local-fs');
      expect(localFs.name).toBe('LocalFilesystem');
      expect(localFs.provider).toBe('local');
    });
  });
});
