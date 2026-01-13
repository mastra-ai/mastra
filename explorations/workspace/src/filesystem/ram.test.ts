/**
 * RamFilesystem Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RamFilesystem } from './providers/ram';
import {
  FileNotFoundError,
  DirectoryNotFoundError,
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotEmptyError,
  FileExistsError,
} from '../types';

describe('RamFilesystem', () => {
  let fs: RamFilesystem;

  beforeEach(() => {
    fs = new RamFilesystem({ id: 'test-fs' });
  });

  describe('readFile / writeFile', () => {
    it('should write and read a file', async () => {
      await fs.writeFile('/test.txt', 'Hello World');
      const content = await fs.readFile('/test.txt', { encoding: 'utf-8' });
      expect(content).toBe('Hello World');
    });

    it('should return Buffer when no encoding specified', async () => {
      await fs.writeFile('/test.txt', 'Hello');
      const content = await fs.readFile('/test.txt');
      expect(Buffer.isBuffer(content)).toBe(true);
    });

    it('should throw FileNotFoundError for non-existent file', async () => {
      await expect(fs.readFile('/nonexistent.txt')).rejects.toThrow(FileNotFoundError);
    });

    it('should throw IsDirectoryError when reading a directory', async () => {
      await fs.mkdir('/dir');
      await expect(fs.readFile('/dir')).rejects.toThrow(IsDirectoryError);
    });

    it('should create parent directories with recursive option', async () => {
      await fs.writeFile('/a/b/c/file.txt', 'content', { recursive: true });
      const content = await fs.readFile('/a/b/c/file.txt', { encoding: 'utf-8' });
      expect(content).toBe('content');
    });

    it('should throw FileExistsError when overwrite is false', async () => {
      await fs.writeFile('/test.txt', 'first');
      await expect(fs.writeFile('/test.txt', 'second', { overwrite: false })).rejects.toThrow(FileExistsError);
    });
  });

  describe('appendFile', () => {
    it('should append to existing file', async () => {
      await fs.writeFile('/test.txt', 'Hello');
      await fs.appendFile('/test.txt', ' World');
      const content = await fs.readFile('/test.txt', { encoding: 'utf-8' });
      expect(content).toBe('Hello World');
    });

    it('should create file if it does not exist', async () => {
      await fs.appendFile('/new.txt', 'Content');
      const content = await fs.readFile('/new.txt', { encoding: 'utf-8' });
      expect(content).toBe('Content');
    });
  });

  describe('deleteFile', () => {
    it('should delete a file', async () => {
      await fs.writeFile('/test.txt', 'content');
      await fs.deleteFile('/test.txt');
      expect(await fs.exists('/test.txt')).toBe(false);
    });

    it('should throw FileNotFoundError for non-existent file', async () => {
      await expect(fs.deleteFile('/nonexistent.txt')).rejects.toThrow(FileNotFoundError);
    });

    it('should not throw with force option', async () => {
      await expect(fs.deleteFile('/nonexistent.txt', { force: true })).resolves.toBeUndefined();
    });
  });

  describe('copyFile', () => {
    it('should copy a file', async () => {
      await fs.writeFile('/source.txt', 'content');
      await fs.copyFile('/source.txt', '/dest.txt');
      const content = await fs.readFile('/dest.txt', { encoding: 'utf-8' });
      expect(content).toBe('content');
    });

    it('should throw FileNotFoundError for non-existent source', async () => {
      await expect(fs.copyFile('/nonexistent.txt', '/dest.txt')).rejects.toThrow(FileNotFoundError);
    });
  });

  describe('moveFile', () => {
    it('should move a file', async () => {
      await fs.writeFile('/source.txt', 'content');
      await fs.moveFile('/source.txt', '/dest.txt');
      expect(await fs.exists('/source.txt')).toBe(false);
      expect(await fs.exists('/dest.txt')).toBe(true);
    });
  });

  describe('mkdir / rmdir', () => {
    it('should create a directory', async () => {
      await fs.mkdir('/dir');
      expect(await fs.isDirectory('/dir')).toBe(true);
    });

    it('should create nested directories with recursive option', async () => {
      await fs.mkdir('/a/b/c', { recursive: true });
      expect(await fs.isDirectory('/a/b/c')).toBe(true);
    });

    it('should remove an empty directory', async () => {
      await fs.mkdir('/dir');
      await fs.rmdir('/dir');
      expect(await fs.exists('/dir')).toBe(false);
    });

    it('should throw DirectoryNotEmptyError for non-empty directory', async () => {
      await fs.mkdir('/dir');
      await fs.writeFile('/dir/file.txt', 'content');
      await expect(fs.rmdir('/dir')).rejects.toThrow(DirectoryNotEmptyError);
    });

    it('should remove non-empty directory with recursive option', async () => {
      await fs.mkdir('/dir');
      await fs.writeFile('/dir/file.txt', 'content');
      await fs.rmdir('/dir', { recursive: true });
      expect(await fs.exists('/dir')).toBe(false);
    });
  });

  describe('readdir', () => {
    it('should list directory contents', async () => {
      await fs.writeFile('/dir/file1.txt', 'content1');
      await fs.writeFile('/dir/file2.txt', 'content2');
      await fs.mkdir('/dir/subdir');

      const entries = await fs.readdir('/dir');
      expect(entries).toHaveLength(3);
      expect(entries.map((e) => e.name).sort()).toEqual(['file1.txt', 'file2.txt', 'subdir']);
    });

    it('should throw DirectoryNotFoundError for non-existent directory', async () => {
      await expect(fs.readdir('/nonexistent')).rejects.toThrow(DirectoryNotFoundError);
    });

    it('should throw NotDirectoryError when path is a file', async () => {
      await fs.writeFile('/file.txt', 'content');
      await expect(fs.readdir('/file.txt')).rejects.toThrow(NotDirectoryError);
    });
  });

  describe('exists / stat / isFile / isDirectory', () => {
    it('should check if path exists', async () => {
      expect(await fs.exists('/nonexistent')).toBe(false);
      await fs.writeFile('/file.txt', 'content');
      expect(await fs.exists('/file.txt')).toBe(true);
    });

    it('should return file stats', async () => {
      await fs.writeFile('/file.txt', 'content');
      const stat = await fs.stat('/file.txt');
      expect(stat.type).toBe('file');
      expect(stat.name).toBe('file.txt');
      expect(stat.size).toBe(7);
    });

    it('should distinguish between files and directories', async () => {
      await fs.writeFile('/file.txt', 'content');
      await fs.mkdir('/dir');
      expect(await fs.isFile('/file.txt')).toBe(true);
      expect(await fs.isFile('/dir')).toBe(false);
      expect(await fs.isDirectory('/dir')).toBe(true);
      expect(await fs.isDirectory('/file.txt')).toBe(false);
    });
  });

  describe('initialFiles', () => {
    it('should populate initial files', async () => {
      const fsWithFiles = new RamFilesystem({
        id: 'test',
        initialFiles: {
          '/config.json': '{"initialized": true}',
          '/README.md': '# Hello',
        },
      });

      expect(await fsWithFiles.exists('/config.json')).toBe(true);
      expect(await fsWithFiles.exists('/README.md')).toBe(true);

      const config = await fsWithFiles.readFile('/config.json', { encoding: 'utf-8' });
      expect(config).toBe('{"initialized": true}');
    });
  });

  describe('lifecycle', () => {
    it('should clear all files on destroy', async () => {
      await fs.writeFile('/file.txt', 'content');
      await fs.destroy();
      expect(await fs.exists('/file.txt')).toBe(false);
    });
  });
});
