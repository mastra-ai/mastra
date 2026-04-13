import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { RequestContext } from '../../request-context';
import {
  FileNotFoundError,
  DirectoryNotFoundError,
  FileExistsError,
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotEmptyError,
  PermissionError,
  StaleFileError,
} from '../errors';
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

      const content = await localFs.readFile('test.txt');
      expect(Buffer.isBuffer(content)).toBe(true);
      expect(content.toString()).toBe('Hello World');
    });

    it('should read file as string with encoding', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'Hello World');

      const content = await localFs.readFile('test.txt', { encoding: 'utf-8' });
      expect(typeof content).toBe('string');
      expect(content).toBe('Hello World');
    });

    it('should throw FileNotFoundError for missing file', async () => {
      await expect(localFs.readFile('nonexistent.txt')).rejects.toThrow(FileNotFoundError);
    });

    it('should throw IsDirectoryError when reading a directory', async () => {
      const dirPath = path.join(tempDir, 'testdir');
      await fs.mkdir(dirPath);

      await expect(localFs.readFile('testdir')).rejects.toThrow(IsDirectoryError);
    });

    it('should read files using relative paths', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'content');

      const content = await localFs.readFile('test.txt', { encoding: 'utf-8' });

      expect(content).toBe('content');
    });
  });

  // ===========================================================================
  // writeFile
  // ===========================================================================
  describe('writeFile', () => {
    it('should write string content', async () => {
      await localFs.writeFile('test.txt', 'Hello World');

      const content = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
      expect(content).toBe('Hello World');
    });

    it('should write buffer content', async () => {
      const buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      await localFs.writeFile('test.bin', buffer);

      const content = await fs.readFile(path.join(tempDir, 'test.bin'));
      expect(content.equals(buffer)).toBe(true);
    });

    it('should create parent directories recursively', async () => {
      await localFs.writeFile('deep/nested/dir/test.txt', 'content');

      const content = await fs.readFile(path.join(tempDir, 'deep/nested/dir/test.txt'), 'utf-8');
      expect(content).toBe('content');
    });

    it('should throw FileExistsError when overwrite is false', async () => {
      await localFs.writeFile('test.txt', 'original');

      await expect(localFs.writeFile('test.txt', 'new', { overwrite: false })).rejects.toThrow(FileExistsError);
    });

    it('should overwrite by default', async () => {
      await localFs.writeFile('test.txt', 'original');
      await localFs.writeFile('test.txt', 'new');

      const content = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
      expect(content).toBe('new');
    });

    // =========================================================================
    // Optimistic concurrency (expectedMtime)
    // =========================================================================

    it('should reject write when expectedMtime does not match (file modified externally)', async () => {
      await localFs.writeFile('test.txt', 'original');
      const stat = await localFs.stat('test.txt');
      const originalMtime = stat.modifiedAt;

      // Simulate external modification (e.g., LSP editor saving)
      await new Promise(resolve => setTimeout(resolve, 50));
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'externally modified');

      await expect(
        localFs.writeFile('test.txt', 'my update', { overwrite: true, expectedMtime: originalMtime }),
      ).rejects.toThrow(StaleFileError);

      // File should still contain the external modification
      const content = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
      expect(content).toBe('externally modified');
    });

    it('should succeed when expectedMtime matches', async () => {
      await localFs.writeFile('test.txt', 'original');
      const stat = await localFs.stat('test.txt');

      await localFs.writeFile('test.txt', 'updated', { overwrite: true, expectedMtime: stat.modifiedAt });

      const content = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
      expect(content).toBe('updated');
    });

    it('should succeed with expectedMtime when file does not exist (new file)', async () => {
      // expectedMtime on a non-existent file should not block the write
      const fakeMtime = new Date('2020-01-01');
      await localFs.writeFile('new-file.txt', 'content', { expectedMtime: fakeMtime });

      const content = await fs.readFile(path.join(tempDir, 'new-file.txt'), 'utf-8');
      expect(content).toBe('content');
    });

    it('should work normally without expectedMtime (existing behavior unchanged)', async () => {
      await localFs.writeFile('test.txt', 'v1');

      // External modification
      await new Promise(resolve => setTimeout(resolve, 50));
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'externally modified');

      // Without expectedMtime, the write should succeed (no check)
      await localFs.writeFile('test.txt', 'v2', { overwrite: true });

      const content = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
      expect(content).toBe('v2');
    });
  });

  // ===========================================================================
  // appendFile
  // ===========================================================================
  describe('appendFile', () => {
    it('should append to existing file', async () => {
      await localFs.writeFile('test.txt', 'Hello');
      await localFs.appendFile('test.txt', ' World');

      const content = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
      expect(content).toBe('Hello World');
    });

    it('should create file if it does not exist', async () => {
      await localFs.appendFile('new.txt', 'content');

      const content = await fs.readFile(path.join(tempDir, 'new.txt'), 'utf-8');
      expect(content).toBe('content');
    });
  });

  // ===========================================================================
  // deleteFile
  // ===========================================================================
  describe('deleteFile', () => {
    it('should delete existing file', async () => {
      await localFs.writeFile('test.txt', 'content');
      await localFs.deleteFile('test.txt');

      const exists = await localFs.exists('test.txt');
      expect(exists).toBe(false);
    });

    it('should throw FileNotFoundError for missing file', async () => {
      await expect(localFs.deleteFile('nonexistent.txt')).rejects.toThrow(FileNotFoundError);
    });

    it('should not throw when force is true and file does not exist', async () => {
      await expect(localFs.deleteFile('nonexistent.txt', { force: true })).resolves.not.toThrow();
    });

    it('should throw IsDirectoryError when deleting directory', async () => {
      await fs.mkdir(path.join(tempDir, 'testdir'));
      await expect(localFs.deleteFile('testdir')).rejects.toThrow(IsDirectoryError);
    });
  });

  // ===========================================================================
  // copyFile
  // ===========================================================================
  describe('copyFile', () => {
    it('should copy file to new location', async () => {
      await localFs.writeFile('source.txt', 'content');
      await localFs.copyFile('source.txt', 'dest.txt');

      const srcContent = await localFs.readFile('source.txt', { encoding: 'utf-8' });
      const destContent = await localFs.readFile('dest.txt', { encoding: 'utf-8' });

      expect(srcContent).toBe('content');
      expect(destContent).toBe('content');
    });

    it('should throw FileNotFoundError for missing source', async () => {
      await expect(localFs.copyFile('nonexistent.txt', 'dest.txt')).rejects.toThrow(FileNotFoundError);
    });

    it('should throw FileExistsError when overwrite is false and dest exists', async () => {
      await localFs.writeFile('source.txt', 'source');
      await localFs.writeFile('dest.txt', 'dest');

      await expect(localFs.copyFile('source.txt', 'dest.txt', { overwrite: false })).rejects.toThrow(FileExistsError);
    });

    it('should copy directory recursively', async () => {
      await localFs.writeFile('srcdir/file1.txt', 'content1');
      await localFs.writeFile('srcdir/file2.txt', 'content2');

      await localFs.copyFile('srcdir', 'destdir', { recursive: true });

      expect(await localFs.readFile('destdir/file1.txt', { encoding: 'utf-8' })).toBe('content1');
      expect(await localFs.readFile('destdir/file2.txt', { encoding: 'utf-8' })).toBe('content2');
    });

    it('should throw IsDirectoryError when copying directory without recursive', async () => {
      await localFs.mkdir('srcdir');
      await expect(localFs.copyFile('srcdir', 'destdir')).rejects.toThrow(IsDirectoryError);
    });
  });

  // ===========================================================================
  // moveFile
  // ===========================================================================
  describe('moveFile', () => {
    it('should move file to new location', async () => {
      await localFs.writeFile('source.txt', 'content');
      await localFs.moveFile('source.txt', 'dest.txt');

      expect(await localFs.exists('source.txt')).toBe(false);
      expect(await localFs.readFile('dest.txt', { encoding: 'utf-8' })).toBe('content');
    });

    it('should throw FileNotFoundError for missing source', async () => {
      await expect(localFs.moveFile('nonexistent.txt', 'dest.txt')).rejects.toThrow(FileNotFoundError);
    });

    it('should throw FileExistsError when overwrite is false and dest exists', async () => {
      await localFs.writeFile('source.txt', 'source');
      await localFs.writeFile('dest.txt', 'dest');

      await expect(localFs.moveFile('source.txt', 'dest.txt', { overwrite: false })).rejects.toThrow(FileExistsError);
    });
  });

  // ===========================================================================
  // mkdir
  // ===========================================================================
  describe('mkdir', () => {
    it('should create directory', async () => {
      await localFs.mkdir('newdir');

      const stats = await fs.stat(path.join(tempDir, 'newdir'));
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create nested directories recursively', async () => {
      await localFs.mkdir('deep/nested/dir');

      const stats = await fs.stat(path.join(tempDir, 'deep/nested/dir'));
      expect(stats.isDirectory()).toBe(true);
    });

    it('should not throw if directory already exists', async () => {
      await localFs.mkdir('testdir');
      await expect(localFs.mkdir('testdir')).resolves.not.toThrow();
    });

    it('should throw FileExistsError if path is a file', async () => {
      await localFs.writeFile('testfile', 'content');
      await expect(localFs.mkdir('testfile', { recursive: false })).rejects.toThrow(FileExistsError);
    });
  });

  // ===========================================================================
  // rmdir
  // ===========================================================================
  describe('rmdir', () => {
    it('should remove empty directory', async () => {
      await localFs.mkdir('emptydir');
      await localFs.rmdir('emptydir');

      expect(await localFs.exists('emptydir')).toBe(false);
    });

    it('should throw DirectoryNotEmptyError for non-empty directory', async () => {
      await localFs.writeFile('nonempty/file.txt', 'content');
      await expect(localFs.rmdir('nonempty')).rejects.toThrow(DirectoryNotEmptyError);
    });

    it('should remove non-empty directory with recursive option', async () => {
      await localFs.writeFile('nonempty/file.txt', 'content');
      await localFs.rmdir('nonempty', { recursive: true, force: true });

      expect(await localFs.exists('nonempty')).toBe(false);
    });

    it('should throw DirectoryNotFoundError for missing directory', async () => {
      await expect(localFs.rmdir('nonexistent')).rejects.toThrow(DirectoryNotFoundError);
    });

    it('should not throw when force is true and directory does not exist', async () => {
      await expect(localFs.rmdir('nonexistent', { force: true })).resolves.not.toThrow();
    });

    it('should throw NotDirectoryError when path is a file', async () => {
      await localFs.writeFile('testfile', 'content');
      await expect(localFs.rmdir('testfile')).rejects.toThrow(NotDirectoryError);
    });
  });

  // ===========================================================================
  // readdir
  // ===========================================================================
  describe('readdir', () => {
    it('should list directory contents', async () => {
      await localFs.writeFile('dir/file1.txt', 'content1');
      await localFs.writeFile('dir/file2.txt', 'content2');
      await localFs.mkdir('dir/subdir');

      const entries = await localFs.readdir('dir');

      expect(entries.length).toBe(3);
      expect(entries.some(e => e.name === 'file1.txt' && e.type === 'file')).toBe(true);
      expect(entries.some(e => e.name === 'file2.txt' && e.type === 'file')).toBe(true);
      expect(entries.some(e => e.name === 'subdir' && e.type === 'directory')).toBe(true);
    });

    it('should include file sizes', async () => {
      await localFs.writeFile('dir/file.txt', 'content');

      const entries = await localFs.readdir('dir');
      const fileEntry = entries.find(e => e.name === 'file.txt');

      expect(fileEntry?.size).toBe(7); // 'content'.length
    });

    it('should filter by extension', async () => {
      await localFs.writeFile('dir/file.txt', 'content');
      await localFs.writeFile('dir/file.json', '{}');

      const txtOnly = await localFs.readdir('dir', { extension: '.txt' });

      expect(txtOnly.length).toBe(1);
      expect(txtOnly[0].name).toBe('file.txt');
    });

    it('should list recursively', async () => {
      await localFs.writeFile('dir/file1.txt', 'content1');
      await localFs.writeFile('dir/sub/file2.txt', 'content2');

      const entries = await localFs.readdir('dir', { recursive: true });

      expect(entries.some(e => e.name === 'file1.txt')).toBe(true);
      expect(entries.some(e => e.name === 'sub/file2.txt')).toBe(true);
    });

    it('should throw DirectoryNotFoundError for missing directory', async () => {
      await expect(localFs.readdir('nonexistent')).rejects.toThrow(DirectoryNotFoundError);
    });

    it('should throw NotDirectoryError when path is a file', async () => {
      await localFs.writeFile('testfile', 'content');
      await expect(localFs.readdir('testfile')).rejects.toThrow(NotDirectoryError);
    });
  });

  // ===========================================================================
  // exists
  // ===========================================================================
  describe('exists', () => {
    it('should return true for existing file', async () => {
      await localFs.writeFile('test.txt', 'content');
      expect(await localFs.exists('test.txt')).toBe(true);
    });

    it('should return true for existing directory', async () => {
      await localFs.mkdir('testdir');
      expect(await localFs.exists('testdir')).toBe(true);
    });

    it('should return false for non-existing path', async () => {
      expect(await localFs.exists('nonexistent')).toBe(false);
    });
  });

  // ===========================================================================
  // stat
  // ===========================================================================
  describe('stat', () => {
    it('should return file stats', async () => {
      await localFs.writeFile('test.txt', 'content');

      const stats = await localFs.stat('test.txt');

      expect(stats.name).toBe('test.txt');
      expect(stats.type).toBe('file');
      expect(stats.size).toBe(7);
      expect(stats.mimeType).toBe('text/plain');
      expect(stats.createdAt).toBeInstanceOf(Date);
      expect(stats.modifiedAt).toBeInstanceOf(Date);
    });

    it('should return directory stats', async () => {
      await localFs.mkdir('testdir');

      const stats = await localFs.stat('testdir');

      expect(stats.name).toBe('testdir');
      expect(stats.type).toBe('directory');
      expect(stats.mimeType).toBeUndefined();
    });

    it('should throw FileNotFoundError for missing path', async () => {
      await expect(localFs.stat('nonexistent')).rejects.toThrow(FileNotFoundError);
    });
  });

  // ===========================================================================
  // Contained Mode (path restrictions)
  // ===========================================================================
  describe('contained mode', () => {
    it('should expose contained getter as true by default', () => {
      expect(localFs.contained).toBe(true);
    });

    it('should expose contained getter as false when set', () => {
      const uncontainedFs = new LocalFilesystem({ basePath: tempDir, contained: false });
      expect(uncontainedFs.contained).toBe(false);
    });

    it('should block path traversal by default', async () => {
      await expect(localFs.readFile('../../../etc/passwd')).rejects.toThrow(PermissionError);
    });

    it('should block path traversal with dot segments', async () => {
      // Use multiple levels of path traversal to escape sandbox
      await expect(localFs.readFile('foo/../../bar/../../../etc/passwd')).rejects.toThrow(PermissionError);
    });

    it('should allow paths inside base directory', async () => {
      await localFs.writeFile('allowed/file.txt', 'content');
      const content = await localFs.readFile('allowed/file.txt', { encoding: 'utf-8' });
      expect(content).toBe('content');
    });

    it('should allow absolute paths inside base directory', async () => {
      await localFs.writeFile('abs-test.txt', 'absolute content');
      const absolutePath = path.join(tempDir, 'abs-test.txt');
      const content = await localFs.readFile(absolutePath, { encoding: 'utf-8' });
      expect(content).toBe('absolute content');
    });

    it('should allow exists() with absolute paths inside base directory', async () => {
      await localFs.writeFile('exists-test.txt', 'content');
      const absolutePath = path.join(tempDir, 'exists-test.txt');
      const exists = await localFs.exists(absolutePath);
      expect(exists).toBe(true);
    });

    it('should not throw on exists() for non-existent absolute path inside base directory', async () => {
      const absolutePath = path.join(tempDir, 'nonexistent', 'file.txt');
      const exists = await localFs.exists(absolutePath);
      expect(exists).toBe(false);
    });

    it('should block absolute paths outside base directory', async () => {
      await expect(localFs.readFile('/etc/passwd')).rejects.toThrow(PermissionError);
      await expect(localFs.writeFile('/tmp/escape.txt', 'nope')).rejects.toThrow(PermissionError);
    });

    it('should not treat absolute paths as workspace-relative (no virtual root)', async () => {
      // Write a file via relative path
      await localFs.writeFile('test.txt', 'relative content');

      // Reading via absolute path /test.txt should NOT find the file at basePath/test.txt —
      // it should throw PermissionError because /test.txt is a real absolute path outside basePath
      await expect(localFs.readFile('/test.txt')).rejects.toThrow(PermissionError);
    });

    it('should resolve the same relative path consistently for read and write', async () => {
      await localFs.writeFile('consistent.txt', 'written');
      const content = await localFs.readFile('consistent.txt', { encoding: 'utf-8' });
      expect(content).toBe('written');
    });

    it('should allow access when containment is disabled', async () => {
      // Create a file in os.tmpdir() (parent of tempDir since tempDir is created via mkdtemp in tmpdir)
      const outsideFile = path.join(os.tmpdir(), 'outside-test.txt');
      await fs.writeFile(outsideFile, 'outside content');

      try {
        const uncontainedFs = new LocalFilesystem({
          basePath: tempDir,
          contained: false,
        });

        // This would be blocked in contained mode, but allowed when contained: false
        const content = await uncontainedFs.readFile(outsideFile, { encoding: 'utf-8' });
        expect(content).toBe('outside content');
      } finally {
        await fs.unlink(outsideFile);
      }
    });

    it('should allow absolute paths outside base directory when containment is disabled', async () => {
      const outsideFile = path.join(os.tmpdir(), 'abs-outside-test.txt');
      await fs.writeFile(outsideFile, 'absolute outside content');

      try {
        const uncontainedFs = new LocalFilesystem({
          basePath: tempDir,
          contained: false,
        });

        // Absolute path outside basePath should work with contained: false
        const content = await uncontainedFs.readFile(outsideFile, { encoding: 'utf-8' });
        expect(content).toBe('absolute outside content');
      } finally {
        await fs.unlink(outsideFile);
      }
    });
  });

  // ===========================================================================
  // allowedPaths
  // ===========================================================================
  describe('allowedPaths', () => {
    let outsideDir: string;

    beforeEach(async () => {
      // Create a directory outside tempDir to use as an allowed path
      outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-fs-allowed-'));
      await fs.writeFile(path.join(outsideDir, 'external.txt'), 'external content');
    });

    afterEach(async () => {
      try {
        await fs.rm(outsideDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    describe('constructor', () => {
      it('should default to empty allowedPaths', () => {
        expect(localFs.allowedPaths).toEqual([]);
      });

      it('should accept allowedPaths in options', () => {
        const fsWithAllowed = new LocalFilesystem({
          basePath: tempDir,
          allowedPaths: [outsideDir],
        });
        expect(fsWithAllowed.allowedPaths).toEqual([outsideDir]);
      });

      it('should resolve relative allowedPaths to absolute', () => {
        const fsWithAllowed = new LocalFilesystem({
          basePath: tempDir,
          allowedPaths: ['./relative-dir'],
        });
        expect(path.isAbsolute(fsWithAllowed.allowedPaths[0])).toBe(true);
      });

      it('should resolve relative allowedPaths against basePath, not cwd', () => {
        const fsWithAllowed = new LocalFilesystem({
          basePath: tempDir,
          allowedPaths: ['./sibling'],
        });
        expect(fsWithAllowed.allowedPaths[0]).toBe(path.resolve(tempDir, 'sibling'));
      });

      it('should resolve ../ allowedPaths against basePath', () => {
        const fsWithAllowed = new LocalFilesystem({
          basePath: tempDir,
          allowedPaths: ['../outside'],
        });
        expect(fsWithAllowed.allowedPaths[0]).toBe(path.resolve(tempDir, '..', 'outside'));
      });

      it('should preserve absolute allowedPaths as-is', () => {
        const fsWithAllowed = new LocalFilesystem({
          basePath: tempDir,
          allowedPaths: [outsideDir],
        });
        expect(fsWithAllowed.allowedPaths[0]).toBe(outsideDir);
      });
    });

    describe('setAllowedPaths', () => {
      it('should set paths from array', () => {
        localFs.setAllowedPaths([outsideDir]);
        expect(localFs.allowedPaths).toEqual([outsideDir]);
      });

      it('should set paths from updater callback', () => {
        localFs.setAllowedPaths([outsideDir]);
        const anotherDir = '/some/other/dir';
        localFs.setAllowedPaths(prev => [...prev, anotherDir]);
        expect(localFs.allowedPaths).toContain(outsideDir);
        expect(localFs.allowedPaths).toContain(anotherDir);
      });

      it('should clear paths with empty array', () => {
        localFs.setAllowedPaths([outsideDir]);
        expect(localFs.allowedPaths.length).toBe(1);
        localFs.setAllowedPaths([]);
        expect(localFs.allowedPaths).toEqual([]);
      });

      it('should resolve paths to absolute', () => {
        localFs.setAllowedPaths(['./foo']);
        expect(path.isAbsolute(localFs.allowedPaths[0])).toBe(true);
      });

      it('should resolve relative paths against basePath, not cwd', () => {
        localFs.setAllowedPaths(['../sibling']);
        expect(localFs.allowedPaths[0]).toBe(path.resolve(tempDir, '..', 'sibling'));
      });
    });

    describe('file operations with allowedPaths', () => {
      it('should read files from an allowed path using absolute path', async () => {
        const fsWithAllowed = new LocalFilesystem({
          basePath: tempDir,
          contained: true,
          allowedPaths: [outsideDir],
        });

        const content = await fsWithAllowed.readFile(path.join(outsideDir, 'external.txt'), {
          encoding: 'utf-8',
        });
        expect(content).toBe('external content');
      });

      it('should write files to an allowed path', async () => {
        const fsWithAllowed = new LocalFilesystem({
          basePath: tempDir,
          contained: true,
          allowedPaths: [outsideDir],
        });

        await fsWithAllowed.writeFile(path.join(outsideDir, 'new-file.txt'), 'new content');

        const content = await fs.readFile(path.join(outsideDir, 'new-file.txt'), 'utf-8');
        expect(content).toBe('new content');
      });

      it('should allow access through the canonical target of a symlinked allowed path', async () => {
        const allowedRootLink = path.join(tempDir, 'allowed-root-link');
        await fs.symlink(outsideDir, allowedRootLink);

        const fsWithAllowed = new LocalFilesystem({
          basePath: tempDir,
          contained: true,
          allowedPaths: [allowedRootLink],
        });

        const content = await fsWithAllowed.readFile(path.join(outsideDir, 'external.txt'), {
          encoding: 'utf-8',
        });
        expect(content).toBe('external content');
      });

      it('should allow access through a symlink path when the canonical root is allowed', async () => {
        const allowedRootLink = path.join(tempDir, 'allowed-root-link');
        await fs.symlink(outsideDir, allowedRootLink);

        const fsWithAllowed = new LocalFilesystem({
          basePath: tempDir,
          contained: true,
          allowedPaths: [outsideDir],
        });

        const content = await fsWithAllowed.readFile(path.join(allowedRootLink, 'external.txt'), {
          encoding: 'utf-8',
        });
        expect(content).toBe('external content');
      });

      it('should block path traversal that escapes all roots', async () => {
        const restrictedFs = new LocalFilesystem({
          basePath: tempDir,
          contained: true,
          allowedPaths: [outsideDir],
        });

        await expect(restrictedFs.readFile('/../../../etc/passwd')).rejects.toThrow(PermissionError);
      });

      it('should allow ../  that stays within an allowed path', async () => {
        // Create a subdirectory with a file
        await fs.mkdir(path.join(outsideDir, 'sub'), { recursive: true });
        await fs.writeFile(path.join(outsideDir, 'sub', 'deep.txt'), 'deep content');

        const fsWithAllowed = new LocalFilesystem({
          basePath: tempDir,
          contained: true,
          allowedPaths: [outsideDir],
        });

        // Navigate into sub then back out, but still within outsideDir
        const content = await fsWithAllowed.readFile(path.join(outsideDir, 'sub', '..', 'external.txt'), {
          encoding: 'utf-8',
        });
        expect(content).toBe('external content');
      });

      it('should block ../ that escapes from allowed path to outside', async () => {
        const fsWithAllowed = new LocalFilesystem({
          basePath: tempDir,
          contained: true,
          allowedPaths: [outsideDir],
        });

        // Try to escape outsideDir via ../
        await expect(fsWithAllowed.readFile(path.join(outsideDir, '..', 'etc', 'passwd'))).rejects.toThrow(
          PermissionError,
        );
      });

      it('should still allow basePath access when allowedPaths are set', async () => {
        const fsWithAllowed = new LocalFilesystem({
          basePath: tempDir,
          contained: true,
          allowedPaths: [outsideDir],
        });

        await fsWithAllowed.writeFile('local-file.txt', 'local content');
        const content = await fsWithAllowed.readFile('local-file.txt', { encoding: 'utf-8' });
        expect(content).toBe('local content');
      });

      it('should respect dynamically added allowedPaths', async () => {
        const dynamicFs = new LocalFilesystem({
          basePath: tempDir,
          contained: true,
        });

        // Initially blocked — absolute path outside basePath throws PermissionError
        await expect(dynamicFs.readFile(path.join(outsideDir, 'external.txt'))).rejects.toThrow(PermissionError);

        // Add allowedPath dynamically
        dynamicFs.setAllowedPaths([outsideDir]);

        // Now accessible
        const content = await dynamicFs.readFile(path.join(outsideDir, 'external.txt'), {
          encoding: 'utf-8',
        });
        expect(content).toBe('external content');
      });

      it('should allow ../ within dynamically added allowedPath', async () => {
        await fs.mkdir(path.join(outsideDir, 'a'), { recursive: true });
        await fs.writeFile(path.join(outsideDir, 'a', 'file.txt'), 'nested');

        const dynamicFs = new LocalFilesystem({
          basePath: tempDir,
          contained: true,
        });

        dynamicFs.setAllowedPaths([outsideDir]);

        // ../  that resolves back into outsideDir
        const content = await dynamicFs.readFile(path.join(outsideDir, 'a', '..', 'external.txt'), {
          encoding: 'utf-8',
        });
        expect(content).toBe('external content');
      });

      it('should block access after removing allowedPaths', async () => {
        const dynamicFs = new LocalFilesystem({
          basePath: tempDir,
          contained: true,
          allowedPaths: [outsideDir],
        });

        // Initially accessible
        const content = await dynamicFs.readFile(path.join(outsideDir, 'external.txt'), {
          encoding: 'utf-8',
        });
        expect(content).toBe('external content');

        // Remove allowed paths
        dynamicFs.setAllowedPaths([]);

        // Now blocked — path no longer within any root
        await expect(dynamicFs.readFile(path.join(outsideDir, 'external.txt'))).rejects.toThrow(PermissionError);
      });

      it('should check exists() against allowedPaths', async () => {
        const fsWithAllowed = new LocalFilesystem({
          basePath: tempDir,
          contained: true,
          allowedPaths: [outsideDir],
        });

        expect(await fsWithAllowed.exists(path.join(outsideDir, 'external.txt'))).toBe(true);
        expect(await fsWithAllowed.exists(path.join(outsideDir, 'nonexistent.txt'))).toBe(false);
      });

      it('should check stat() against allowedPaths', async () => {
        const fsWithAllowed = new LocalFilesystem({
          basePath: tempDir,
          contained: true,
          allowedPaths: [outsideDir],
        });

        const stat = await fsWithAllowed.stat(path.join(outsideDir, 'external.txt'));
        expect(stat.type).toBe('file');
        expect(stat.size).toBe('external content'.length);
      });

      it('should allow readdir on allowed path', async () => {
        const fsWithAllowed = new LocalFilesystem({
          basePath: tempDir,
          contained: true,
          allowedPaths: [outsideDir],
        });

        const entries = await fsWithAllowed.readdir(outsideDir);
        expect(entries.some(e => e.name === 'external.txt')).toBe(true);
      });
    });

    describe('relative allowedPaths with ../', () => {
      let parentDir: string;
      let childBase: string;
      let siblingDir: string;

      beforeEach(async () => {
        // Create: parentDir/child (basePath) and parentDir/sibling (allowed via ../)
        parentDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-fs-relative-'));
        childBase = path.join(parentDir, 'child');
        siblingDir = path.join(parentDir, 'sibling');
        await fs.mkdir(childBase, { recursive: true });
        await fs.mkdir(siblingDir, { recursive: true });
        await fs.writeFile(path.join(siblingDir, 'sibling.txt'), 'sibling content');
      });

      afterEach(async () => {
        try {
          await fs.rm(parentDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      });

      it('should allow reading files from a ../ relative allowedPath', async () => {
        const fsWithRelativeAllowed = new LocalFilesystem({
          basePath: childBase,
          contained: true,
          allowedPaths: ['../sibling'],
        });

        const content = await fsWithRelativeAllowed.readFile(path.join(siblingDir, 'sibling.txt'), {
          encoding: 'utf-8',
        });
        expect(content).toBe('sibling content');
      });

      it('should allow exists() on a ../ relative allowedPath', async () => {
        const fsWithRelativeAllowed = new LocalFilesystem({
          basePath: childBase,
          contained: true,
          allowedPaths: ['../sibling'],
        });

        expect(await fsWithRelativeAllowed.exists(path.join(siblingDir, 'sibling.txt'))).toBe(true);
      });

      it('should block access to paths outside both basePath and relative allowedPaths', async () => {
        const fsWithRelativeAllowed = new LocalFilesystem({
          basePath: childBase,
          contained: true,
          allowedPaths: ['../sibling'],
        });

        await expect(fsWithRelativeAllowed.readFile('/etc/passwd')).rejects.toThrow(PermissionError);
      });

      it('should allow exists() on a non-existent path under a non-existent allowedPath', async () => {
        // This reproduces the bug where assertPathContained skipped non-existent
        // allowedPaths from rootReals, causing PermissionError even though
        // _isWithinAnyRoot passed.
        const nonExistentAllowed = path.join(parentDir, 'not-yet-created');
        const fsWithNonExistent = new LocalFilesystem({
          basePath: childBase,
          contained: true,
          allowedPaths: [nonExistentAllowed],
        });

        // Should not throw PermissionError — the path doesn't exist but containment is valid
        const result = await fsWithNonExistent.exists(path.join(nonExistentAllowed, 'some-file.txt'));
        expect(result).toBe(false);
      });

      it('should allow setAllowedPaths with ../ to grant access', async () => {
        const dynamicFs = new LocalFilesystem({
          basePath: childBase,
          contained: true,
        });

        // Initially blocked
        await expect(dynamicFs.readFile(path.join(siblingDir, 'sibling.txt'))).rejects.toThrow(PermissionError);

        // Add via relative ../
        dynamicFs.setAllowedPaths(['../sibling']);

        // Now accessible
        const content = await dynamicFs.readFile(path.join(siblingDir, 'sibling.txt'), {
          encoding: 'utf-8',
        });
        expect(content).toBe('sibling content');
      });
    });

    describe('getInfo with allowedPaths', () => {
      it('should not include allowedPaths in metadata when empty', () => {
        const info = localFs.getInfo();
        expect(info.metadata?.allowedPaths).toBeUndefined();
      });

      it('should include allowedPaths in metadata when set', () => {
        const fsWithAllowed = new LocalFilesystem({
          basePath: tempDir,
          allowedPaths: [outsideDir],
        });
        const info = fsWithAllowed.getInfo();
        expect(info.metadata?.allowedPaths).toEqual([outsideDir]);
      });
    });

    describe('getInstructions with allowedPaths', () => {
      it('should not mention allowedPaths when empty', () => {
        const instructions = localFs.getInstructions();
        expect(instructions).not.toContain('allowed paths');
      });

      it('should mention allowedPaths when set', () => {
        const fsWithAllowed = new LocalFilesystem({
          basePath: tempDir,
          allowedPaths: [outsideDir],
        });
        const instructions = fsWithAllowed.getInstructions();
        expect(instructions).toContain('allowed paths');
        expect(instructions).toContain(outsideDir);
      });
    });
  });

  // ===========================================================================
  // getInstructions with custom override
  // ===========================================================================
  describe('getInstructions with custom override', () => {
    it('should return custom instructions when provided', () => {
      const testFs = new LocalFilesystem({
        basePath: tempDir,
        instructions: 'Custom filesystem instructions here.',
      });
      expect(testFs.getInstructions()).toBe('Custom filesystem instructions here.');
    });

    it('should return empty string when override is empty string', () => {
      const testFs = new LocalFilesystem({
        basePath: tempDir,
        instructions: '',
      });
      expect(testFs.getInstructions()).toBe('');
    });

    it('should return auto-generated instructions when no override', () => {
      const testFs = new LocalFilesystem({ basePath: tempDir });
      expect(testFs.getInstructions()).toContain('Local filesystem');
    });

    it('should support function form that extends auto instructions', () => {
      const testFs = new LocalFilesystem({
        basePath: tempDir,
        instructions: ({ defaultInstructions }) => `${defaultInstructions}\nExtra info.`,
      });
      const result = testFs.getInstructions();
      expect(result).toContain('Local filesystem');
      expect(result).toContain('Extra info.');
    });

    it('should pass requestContext to function form', () => {
      const ctx = new RequestContext([['locale', 'fr']]);
      const fn = vi.fn(({ defaultInstructions, requestContext }: any) => {
        return `${defaultInstructions} locale=${requestContext?.get('locale')}`;
      });
      const testFs = new LocalFilesystem({
        basePath: tempDir,
        instructions: fn,
      });
      const result = testFs.getInstructions({ requestContext: ctx });
      expect(fn).toHaveBeenCalledOnce();
      expect(result).toContain('locale=fr');
      expect(result).toContain('Local filesystem');
    });

    it('should pass undefined requestContext when not provided to function form', () => {
      const fn = vi.fn(({ defaultInstructions, requestContext }: any) => {
        return `${defaultInstructions} ctx=${String(requestContext)}`;
      });
      const testFs = new LocalFilesystem({
        basePath: tempDir,
        instructions: fn,
      });
      const result = testFs.getInstructions();
      expect(result).toContain('ctx=undefined');
    });
  });

  // ===========================================================================
  // Tilde (~) expansion
  // ===========================================================================
  describe('tilde expansion', () => {
    let homeDir: string;
    let tildeTargetDir: string;

    beforeEach(async () => {
      homeDir = os.homedir();
      // Create a temp directory inside the real home dir for tilde tests
      tildeTargetDir = await fs.mkdtemp(path.join(homeDir, '.mastra-tilde-test-'));
    });

    afterEach(async () => {
      try {
        await fs.rm(tildeTargetDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should expand ~ in basePath', () => {
      const tildeFs = new LocalFilesystem({ basePath: '~/my-project' });
      expect(tildeFs.basePath).toBe(path.join(homeDir, 'my-project'));
    });

    it('should expand ~ in allowedPaths constructor option', () => {
      const tildeFs = new LocalFilesystem({
        basePath: tempDir,
        allowedPaths: ['~/allowed-dir'],
      });
      expect(tildeFs.allowedPaths).toEqual([path.join(homeDir, 'allowed-dir')]);
    });

    it('should expand ~ to home directory when contained is false', async () => {
      const uncontainedFs = new LocalFilesystem({
        basePath: tempDir,
        contained: false,
      });
      const relativeTildePath = tildeTargetDir.replace(homeDir, '~');
      const filePath = `${relativeTildePath}/tilde-test.txt`;

      await uncontainedFs.writeFile(filePath, 'tilde works');

      const absoluteExpected = path.join(tildeTargetDir, 'tilde-test.txt');
      const content = await fs.readFile(absoluteExpected, 'utf-8');
      expect(content).toBe('tilde works');
    });

    it('should expand ~ to home directory when path is in allowedPaths', async () => {
      const relativeTildeDir = tildeTargetDir.replace(homeDir, '~');
      const fsWithAllowed = new LocalFilesystem({
        basePath: tempDir,
        contained: true,
        allowedPaths: [relativeTildeDir],
      });
      const filePath = `${relativeTildeDir}/tilde-allowed.txt`;

      await fsWithAllowed.writeFile(filePath, 'tilde allowed works');

      const absoluteExpected = path.join(tildeTargetDir, 'tilde-allowed.txt');
      const content = await fs.readFile(absoluteExpected, 'utf-8');
      expect(content).toBe('tilde allowed works');
    });

    it('should expand ~ in setAllowedPaths', async () => {
      const relativeTildeDir = tildeTargetDir.replace(homeDir, '~');
      localFs.setAllowedPaths([relativeTildeDir]);

      const filePath = `${relativeTildeDir}/tilde-set-allowed.txt`;
      await localFs.writeFile(filePath, 'tilde set allowed works');

      const absoluteExpected = path.join(tildeTargetDir, 'tilde-set-allowed.txt');
      const content = await fs.readFile(absoluteExpected, 'utf-8');
      expect(content).toBe('tilde set allowed works');
    });

    it('should throw PermissionError for tilde path outside basePath in contained mode', async () => {
      const relativeTildeDir = tildeTargetDir.replace(homeDir, '~');
      const filePath = `${relativeTildeDir}/contained.txt`;

      // contained: true, no allowedPaths — tilde expands to a real absolute path
      // outside basePath, so it should throw PermissionError (not nest under basePath)
      await expect(localFs.writeFile(filePath, 'should not be here')).rejects.toThrow('Permission');
    });

    it('should read files written via tilde path', async () => {
      const uncontainedFs = new LocalFilesystem({
        basePath: tempDir,
        contained: false,
      });
      const relativeTildePath = tildeTargetDir.replace(homeDir, '~');

      // Write directly to disk
      await fs.writeFile(path.join(tildeTargetDir, 'read-test.txt'), 'read via tilde');

      // Read via tilde path
      const content = await uncontainedFs.readFile(`${relativeTildePath}/read-test.txt`);
      expect(content.toString()).toBe('read via tilde');
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
        await localFs.writeFile(`test.${ext}`, 'content');
        const stats = await localFs.stat(`test.${ext}`);
        expect(stats.mimeType).toBe(expected);
      });
    });
  });
});
