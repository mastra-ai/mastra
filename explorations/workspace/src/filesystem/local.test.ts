/**
 * LocalFilesystem Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { LocalFilesystem } from './providers/local';
import {
  FileNotFoundError,
  DirectoryNotFoundError,
  IsDirectoryError,
  NotDirectoryError,
  PermissionError,
} from '../types';

describe('LocalFilesystem', () => {
  let localFs: LocalFilesystem;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-local-fs-test-'));
    localFs = new LocalFilesystem({ id: 'test-local-fs', basePath: tempDir });
    await localFs.init();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('readFile / writeFile', () => {
    it('should write and read a file', async () => {
      await localFs.writeFile('/test.txt', 'Hello World');
      const content = await localFs.readFile('/test.txt', { encoding: 'utf-8' });
      expect(content).toBe('Hello World');
    });

    it('should return Buffer when no encoding specified', async () => {
      await localFs.writeFile('/test.txt', 'Hello');
      const content = await localFs.readFile('/test.txt');
      expect(Buffer.isBuffer(content)).toBe(true);
    });

    it('should throw FileNotFoundError for non-existent file', async () => {
      await expect(localFs.readFile('/nonexistent.txt')).rejects.toThrow(FileNotFoundError);
    });

    it('should throw IsDirectoryError when reading a directory', async () => {
      await localFs.mkdir('/dir');
      await expect(localFs.readFile('/dir')).rejects.toThrow(IsDirectoryError);
    });

    it('should create parent directories with recursive option', async () => {
      await localFs.writeFile('/a/b/c/file.txt', 'content', { recursive: true });
      const content = await localFs.readFile('/a/b/c/file.txt', { encoding: 'utf-8' });
      expect(content).toBe('content');
    });
  });

  describe('deleteFile', () => {
    it('should delete a file', async () => {
      await localFs.writeFile('/test.txt', 'content');
      await localFs.deleteFile('/test.txt');
      expect(await localFs.exists('/test.txt')).toBe(false);
    });

    it('should throw FileNotFoundError for non-existent file', async () => {
      await expect(localFs.deleteFile('/nonexistent.txt')).rejects.toThrow(FileNotFoundError);
    });
  });

  describe('mkdir / rmdir', () => {
    it('should create and remove a directory', async () => {
      await localFs.mkdir('/dir');
      expect(await localFs.isDirectory('/dir')).toBe(true);
      await localFs.rmdir('/dir');
      expect(await localFs.exists('/dir')).toBe(false);
    });
  });

  describe('readdir', () => {
    it('should list directory contents', async () => {
      await localFs.writeFile('/dir/file.txt', 'content');
      await localFs.mkdir('/dir/subdir');

      const entries = await localFs.readdir('/dir');
      expect(entries.map((e) => e.name).sort()).toEqual(['file.txt', 'subdir']);
    });

    it('should throw DirectoryNotFoundError for non-existent directory', async () => {
      await expect(localFs.readdir('/nonexistent')).rejects.toThrow(DirectoryNotFoundError);
    });

    it('should throw NotDirectoryError when path is a file', async () => {
      await localFs.writeFile('/file.txt', 'content');
      await expect(localFs.readdir('/file.txt')).rejects.toThrow(NotDirectoryError);
    });
  });

  describe('sandbox protection', () => {
    it('should prevent path traversal attacks', async () => {
      await expect(localFs.readFile('/../../../etc/passwd')).rejects.toThrow(PermissionError);
    });

    it('should prevent absolute paths outside sandbox', async () => {
      await expect(localFs.readFile('/../../../../etc/passwd')).rejects.toThrow(PermissionError);
    });
  });

  describe('exists / stat', () => {
    it('should check if path exists', async () => {
      expect(await localFs.exists('/nonexistent')).toBe(false);
      await localFs.writeFile('/file.txt', 'content');
      expect(await localFs.exists('/file.txt')).toBe(true);
    });

    it('should return file stats', async () => {
      await localFs.writeFile('/file.txt', 'content');
      const stat = await localFs.stat('/file.txt');
      expect(stat.type).toBe('file');
      expect(stat.name).toBe('file.txt');
    });
  });
});
