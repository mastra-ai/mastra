import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  FileNotFoundError,
  DirectoryNotFoundError,
  FileExistsError,
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotEmptyError,
  PermissionError,
} from './filesystem';
import { LocalFilesystem } from './local-filesystem';

describe('LocalFilesystem', () => {
  let tempDir: string;
  let localFs: LocalFilesystem;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-fs-test-'));
    localFs = new LocalFilesystem({ basePath: tempDir });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ===========================================================================
  // Constructor
  // ===========================================================================
  describe('constructor', () => {
    it('should create filesystem with default values', () => {
      expect(localFs.provider).toBe('local');
      expect(localFs.name).toBe('LocalFilesystem');
      expect(localFs.id).toBeDefined();
    });

    it('should accept custom id', () => {
      const customFs = new LocalFilesystem({
        id: 'custom-id',
        basePath: tempDir,
      });
      expect(customFs.id).toBe('custom-id');
    });
  });

  // ===========================================================================
  // init
  // ===========================================================================
  describe('init', () => {
    it('should create base directory if it does not exist', async () => {
      const newDir = path.join(tempDir, 'new-base');
      const newFs = new LocalFilesystem({ basePath: newDir });

      await newFs.init();

      const stats = await fs.stat(newDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  // ===========================================================================
  // readFile
  // ===========================================================================
  describe('readFile', () => {
    it('should read file as buffer by default', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'Hello World');

      const content = await localFs.readFile('/test.txt');
      expect(Buffer.isBuffer(content)).toBe(true);
      expect(content.toString()).toBe('Hello World');
    });

    it('should read file as string with encoding', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'Hello World');

      const content = await localFs.readFile('/test.txt', { encoding: 'utf-8' });
      expect(typeof content).toBe('string');
      expect(content).toBe('Hello World');
    });

    it('should throw FileNotFoundError for missing file', async () => {
      await expect(localFs.readFile('/nonexistent.txt')).rejects.toThrow(FileNotFoundError);
    });

    it('should throw IsDirectoryError when reading a directory', async () => {
      const dirPath = path.join(tempDir, 'testdir');
      await fs.mkdir(dirPath);

      await expect(localFs.readFile('/testdir')).rejects.toThrow(IsDirectoryError);
    });

    it('should normalize paths with leading slashes', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'content');

      const content1 = await localFs.readFile('/test.txt', { encoding: 'utf-8' });
      const content2 = await localFs.readFile('test.txt', { encoding: 'utf-8' });

      expect(content1).toBe('content');
      expect(content2).toBe('content');
    });
  });

  // ===========================================================================
  // writeFile
  // ===========================================================================
  describe('writeFile', () => {
    it('should write string content', async () => {
      await localFs.writeFile('/test.txt', 'Hello World');

      const content = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
      expect(content).toBe('Hello World');
    });

    it('should write buffer content', async () => {
      const buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      await localFs.writeFile('/test.bin', buffer);

      const content = await fs.readFile(path.join(tempDir, 'test.bin'));
      expect(content.equals(buffer)).toBe(true);
    });

    it('should create parent directories recursively', async () => {
      await localFs.writeFile('/deep/nested/dir/test.txt', 'content');

      const content = await fs.readFile(path.join(tempDir, 'deep/nested/dir/test.txt'), 'utf-8');
      expect(content).toBe('content');
    });

    it('should throw FileExistsError when overwrite is false', async () => {
      await localFs.writeFile('/test.txt', 'original');

      await expect(localFs.writeFile('/test.txt', 'new', { overwrite: false })).rejects.toThrow(FileExistsError);
    });

    it('should overwrite by default', async () => {
      await localFs.writeFile('/test.txt', 'original');
      await localFs.writeFile('/test.txt', 'new');

      const content = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
      expect(content).toBe('new');
    });
  });

  // ===========================================================================
  // appendFile
  // ===========================================================================
  describe('appendFile', () => {
    it('should append to existing file', async () => {
      await localFs.writeFile('/test.txt', 'Hello');
      await localFs.appendFile('/test.txt', ' World');

      const content = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
      expect(content).toBe('Hello World');
    });

    it('should create file if it does not exist', async () => {
      await localFs.appendFile('/new.txt', 'content');

      const content = await fs.readFile(path.join(tempDir, 'new.txt'), 'utf-8');
      expect(content).toBe('content');
    });
  });

  // ===========================================================================
  // deleteFile
  // ===========================================================================
  describe('deleteFile', () => {
    it('should delete existing file', async () => {
      await localFs.writeFile('/test.txt', 'content');
      await localFs.deleteFile('/test.txt');

      const exists = await localFs.exists('/test.txt');
      expect(exists).toBe(false);
    });

    it('should throw FileNotFoundError for missing file', async () => {
      await expect(localFs.deleteFile('/nonexistent.txt')).rejects.toThrow(FileNotFoundError);
    });

    it('should not throw when force is true and file does not exist', async () => {
      await expect(localFs.deleteFile('/nonexistent.txt', { force: true })).resolves.not.toThrow();
    });

    it('should throw IsDirectoryError when deleting directory', async () => {
      await fs.mkdir(path.join(tempDir, 'testdir'));
      await expect(localFs.deleteFile('/testdir')).rejects.toThrow(IsDirectoryError);
    });
  });

  // ===========================================================================
  // copyFile
  // ===========================================================================
  describe('copyFile', () => {
    it('should copy file to new location', async () => {
      await localFs.writeFile('/source.txt', 'content');
      await localFs.copyFile('/source.txt', '/dest.txt');

      const srcContent = await localFs.readFile('/source.txt', { encoding: 'utf-8' });
      const destContent = await localFs.readFile('/dest.txt', { encoding: 'utf-8' });

      expect(srcContent).toBe('content');
      expect(destContent).toBe('content');
    });

    it('should throw FileNotFoundError for missing source', async () => {
      await expect(localFs.copyFile('/nonexistent.txt', '/dest.txt')).rejects.toThrow(FileNotFoundError);
    });

    it('should throw FileExistsError when overwrite is false and dest exists', async () => {
      await localFs.writeFile('/source.txt', 'source');
      await localFs.writeFile('/dest.txt', 'dest');

      await expect(localFs.copyFile('/source.txt', '/dest.txt', { overwrite: false })).rejects.toThrow(FileExistsError);
    });

    it('should copy directory recursively', async () => {
      await localFs.writeFile('/srcdir/file1.txt', 'content1');
      await localFs.writeFile('/srcdir/file2.txt', 'content2');

      await localFs.copyFile('/srcdir', '/destdir', { recursive: true });

      expect(await localFs.readFile('/destdir/file1.txt', { encoding: 'utf-8' })).toBe('content1');
      expect(await localFs.readFile('/destdir/file2.txt', { encoding: 'utf-8' })).toBe('content2');
    });

    it('should throw IsDirectoryError when copying directory without recursive', async () => {
      await localFs.mkdir('/srcdir');
      await expect(localFs.copyFile('/srcdir', '/destdir')).rejects.toThrow(IsDirectoryError);
    });
  });

  // ===========================================================================
  // moveFile
  // ===========================================================================
  describe('moveFile', () => {
    it('should move file to new location', async () => {
      await localFs.writeFile('/source.txt', 'content');
      await localFs.moveFile('/source.txt', '/dest.txt');

      expect(await localFs.exists('/source.txt')).toBe(false);
      expect(await localFs.readFile('/dest.txt', { encoding: 'utf-8' })).toBe('content');
    });

    it('should throw FileNotFoundError for missing source', async () => {
      await expect(localFs.moveFile('/nonexistent.txt', '/dest.txt')).rejects.toThrow(FileNotFoundError);
    });

    it('should throw FileExistsError when overwrite is false and dest exists', async () => {
      await localFs.writeFile('/source.txt', 'source');
      await localFs.writeFile('/dest.txt', 'dest');

      await expect(localFs.moveFile('/source.txt', '/dest.txt', { overwrite: false })).rejects.toThrow(FileExistsError);
    });
  });

  // ===========================================================================
  // mkdir
  // ===========================================================================
  describe('mkdir', () => {
    it('should create directory', async () => {
      await localFs.mkdir('/newdir');

      const stats = await fs.stat(path.join(tempDir, 'newdir'));
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create nested directories recursively', async () => {
      await localFs.mkdir('/deep/nested/dir');

      const stats = await fs.stat(path.join(tempDir, 'deep/nested/dir'));
      expect(stats.isDirectory()).toBe(true);
    });

    it('should not throw if directory already exists', async () => {
      await localFs.mkdir('/testdir');
      await expect(localFs.mkdir('/testdir')).resolves.not.toThrow();
    });

    it('should throw FileExistsError if path is a file', async () => {
      await localFs.writeFile('/testfile', 'content');
      await expect(localFs.mkdir('/testfile', { recursive: false })).rejects.toThrow(FileExistsError);
    });
  });

  // ===========================================================================
  // rmdir
  // ===========================================================================
  describe('rmdir', () => {
    it('should remove empty directory', async () => {
      await localFs.mkdir('/emptydir');
      await localFs.rmdir('/emptydir');

      expect(await localFs.exists('/emptydir')).toBe(false);
    });

    it('should throw DirectoryNotEmptyError for non-empty directory', async () => {
      await localFs.writeFile('/nonempty/file.txt', 'content');
      await expect(localFs.rmdir('/nonempty')).rejects.toThrow(DirectoryNotEmptyError);
    });

    it('should remove non-empty directory with recursive option', async () => {
      await localFs.writeFile('/nonempty/file.txt', 'content');
      await localFs.rmdir('/nonempty', { recursive: true, force: true });

      expect(await localFs.exists('/nonempty')).toBe(false);
    });

    it('should throw DirectoryNotFoundError for missing directory', async () => {
      await expect(localFs.rmdir('/nonexistent')).rejects.toThrow(DirectoryNotFoundError);
    });

    it('should not throw when force is true and directory does not exist', async () => {
      await expect(localFs.rmdir('/nonexistent', { force: true })).resolves.not.toThrow();
    });

    it('should throw NotDirectoryError when path is a file', async () => {
      await localFs.writeFile('/testfile', 'content');
      await expect(localFs.rmdir('/testfile')).rejects.toThrow(NotDirectoryError);
    });
  });

  // ===========================================================================
  // readdir
  // ===========================================================================
  describe('readdir', () => {
    it('should list directory contents', async () => {
      await localFs.writeFile('/dir/file1.txt', 'content1');
      await localFs.writeFile('/dir/file2.txt', 'content2');
      await localFs.mkdir('/dir/subdir');

      const entries = await localFs.readdir('/dir');

      expect(entries.length).toBe(3);
      expect(entries.some(e => e.name === 'file1.txt' && e.type === 'file')).toBe(true);
      expect(entries.some(e => e.name === 'file2.txt' && e.type === 'file')).toBe(true);
      expect(entries.some(e => e.name === 'subdir' && e.type === 'directory')).toBe(true);
    });

    it('should include file sizes', async () => {
      await localFs.writeFile('/dir/file.txt', 'content');

      const entries = await localFs.readdir('/dir');
      const fileEntry = entries.find(e => e.name === 'file.txt');

      expect(fileEntry?.size).toBe(7); // 'content'.length
    });

    it('should filter by extension', async () => {
      await localFs.writeFile('/dir/file.txt', 'content');
      await localFs.writeFile('/dir/file.json', '{}');

      const txtOnly = await localFs.readdir('/dir', { extension: '.txt' });

      expect(txtOnly.length).toBe(1);
      expect(txtOnly[0].name).toBe('file.txt');
    });

    it('should list recursively', async () => {
      await localFs.writeFile('/dir/file1.txt', 'content1');
      await localFs.writeFile('/dir/sub/file2.txt', 'content2');

      const entries = await localFs.readdir('/dir', { recursive: true });

      expect(entries.some(e => e.name === 'file1.txt')).toBe(true);
      expect(entries.some(e => e.name === 'sub/file2.txt')).toBe(true);
    });

    it('should throw DirectoryNotFoundError for missing directory', async () => {
      await expect(localFs.readdir('/nonexistent')).rejects.toThrow(DirectoryNotFoundError);
    });

    it('should throw NotDirectoryError when path is a file', async () => {
      await localFs.writeFile('/testfile', 'content');
      await expect(localFs.readdir('/testfile')).rejects.toThrow(NotDirectoryError);
    });
  });

  // ===========================================================================
  // exists
  // ===========================================================================
  describe('exists', () => {
    it('should return true for existing file', async () => {
      await localFs.writeFile('/test.txt', 'content');
      expect(await localFs.exists('/test.txt')).toBe(true);
    });

    it('should return true for existing directory', async () => {
      await localFs.mkdir('/testdir');
      expect(await localFs.exists('/testdir')).toBe(true);
    });

    it('should return false for non-existing path', async () => {
      expect(await localFs.exists('/nonexistent')).toBe(false);
    });
  });

  // ===========================================================================
  // stat
  // ===========================================================================
  describe('stat', () => {
    it('should return file stats', async () => {
      await localFs.writeFile('/test.txt', 'content');

      const stats = await localFs.stat('/test.txt');

      expect(stats.name).toBe('test.txt');
      expect(stats.type).toBe('file');
      expect(stats.size).toBe(7);
      expect(stats.mimeType).toBe('text/plain');
      expect(stats.createdAt).toBeInstanceOf(Date);
      expect(stats.modifiedAt).toBeInstanceOf(Date);
    });

    it('should return directory stats', async () => {
      await localFs.mkdir('/testdir');

      const stats = await localFs.stat('/testdir');

      expect(stats.name).toBe('testdir');
      expect(stats.type).toBe('directory');
      expect(stats.mimeType).toBeUndefined();
    });

    it('should throw FileNotFoundError for missing path', async () => {
      await expect(localFs.stat('/nonexistent')).rejects.toThrow(FileNotFoundError);
    });
  });

  // ===========================================================================
  // isFile / isDirectory
  // ===========================================================================
  describe('isFile', () => {
    it('should return true for files', async () => {
      await localFs.writeFile('/test.txt', 'content');
      expect(await localFs.isFile('/test.txt')).toBe(true);
    });

    it('should return false for directories', async () => {
      await localFs.mkdir('/testdir');
      expect(await localFs.isFile('/testdir')).toBe(false);
    });

    it('should return false for non-existing paths', async () => {
      expect(await localFs.isFile('/nonexistent')).toBe(false);
    });
  });

  describe('isDirectory', () => {
    it('should return true for directories', async () => {
      await localFs.mkdir('/testdir');
      expect(await localFs.isDirectory('/testdir')).toBe(true);
    });

    it('should return false for files', async () => {
      await localFs.writeFile('/test.txt', 'content');
      expect(await localFs.isDirectory('/test.txt')).toBe(false);
    });

    it('should return false for non-existing paths', async () => {
      expect(await localFs.isDirectory('/nonexistent')).toBe(false);
    });
  });

  // ===========================================================================
  // Sandbox Mode (path restrictions)
  // ===========================================================================
  describe('sandbox mode', () => {
    it('should block path traversal by default', async () => {
      await expect(localFs.readFile('/../../../etc/passwd')).rejects.toThrow(PermissionError);
    });

    it('should block path traversal with dot segments', async () => {
      // Use multiple levels of path traversal to escape sandbox
      await expect(localFs.readFile('/foo/../../bar/../../../etc/passwd')).rejects.toThrow(PermissionError);
    });

    it('should allow paths inside base directory', async () => {
      await localFs.writeFile('/allowed/file.txt', 'content');
      const content = await localFs.readFile('/allowed/file.txt', { encoding: 'utf-8' });
      expect(content).toBe('content');
    });

    it('should allow access when sandbox is disabled', async () => {
      // Create a file outside the sandbox
      const outsideFile = path.join(os.tmpdir(), 'outside-test.txt');
      await fs.writeFile(outsideFile, 'outside content');

      try {
        const unsandboxedFs = new LocalFilesystem({
          basePath: tempDir,
          sandbox: false,
        });

        // This would be blocked in sandbox mode, but allowed when sandbox: false
        // Note: We use a relative path that goes outside the base
        const content = await unsandboxedFs.readFile(`/../${path.basename(outsideFile)}`, { encoding: 'utf-8' });
        expect(content).toBe('outside content');
      } finally {
        await fs.unlink(outsideFile);
      }
    });
  });

  // ===========================================================================
  // MIME Type Detection
  // ===========================================================================
  describe('mime type detection', () => {
    const testCases = [
      { ext: 'txt', expected: 'text/plain' },
      { ext: 'html', expected: 'text/html' },
      { ext: 'css', expected: 'text/css' },
      { ext: 'js', expected: 'application/javascript' },
      { ext: 'ts', expected: 'application/typescript' },
      { ext: 'json', expected: 'application/json' },
      { ext: 'xml', expected: 'application/xml' },
      { ext: 'md', expected: 'text/markdown' },
      { ext: 'py', expected: 'text/x-python' },
      { ext: 'unknown', expected: 'application/octet-stream' },
    ];

    testCases.forEach(({ ext, expected }) => {
      it(`should detect ${ext} as ${expected}`, async () => {
        await localFs.writeFile(`/test.${ext}`, 'content');
        const stats = await localFs.stat(`/test.${ext}`);
        expect(stats.mimeType).toBe(expected);
      });
    });
  });
});
