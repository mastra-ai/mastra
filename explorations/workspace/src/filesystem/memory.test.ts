import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryFilesystem, createMemoryFilesystem } from './memory';
import {
  FileNotFoundError,
  DirectoryNotFoundError,
  IsDirectoryError,
  NotDirectoryError,
  FileExistsError,
  DirectoryNotEmptyError,
} from './types';

describe('MemoryFilesystem', () => {
  let fs: MemoryFilesystem;

  beforeEach(() => {
    fs = createMemoryFilesystem({ id: 'test-fs', provider: 'memory' });
  });

  describe('writeFile and readFile', () => {
    it('should write and read a text file', async () => {
      await fs.writeFile('/test.txt', 'Hello, World!');
      const content = await fs.readFile('/test.txt', { encoding: 'utf-8' });
      expect(content).toBe('Hello, World!');
    });

    it('should write and read a binary file', async () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      await fs.writeFile('/test.bin', buffer);
      const content = await fs.readFile('/test.bin');
      expect(Buffer.isBuffer(content)).toBe(true);
      expect(content).toEqual(buffer);
    });

    it('should create parent directories by default', async () => {
      await fs.writeFile('/deep/nested/path/file.txt', 'content');
      const content = await fs.readFile('/deep/nested/path/file.txt', { encoding: 'utf-8' });
      expect(content).toBe('content');
    });

    it('should throw FileNotFoundError when reading non-existent file', async () => {
      await expect(fs.readFile('/nonexistent.txt')).rejects.toThrow(FileNotFoundError);
    });

    it('should throw IsDirectoryError when reading a directory', async () => {
      await fs.mkdir('/testdir');
      await expect(fs.readFile('/testdir')).rejects.toThrow(IsDirectoryError);
    });

    it('should throw FileExistsError when overwrite is false', async () => {
      await fs.writeFile('/test.txt', 'original');
      await expect(
        fs.writeFile('/test.txt', 'new content', { overwrite: false }),
      ).rejects.toThrow(FileExistsError);
    });

    it('should overwrite by default', async () => {
      await fs.writeFile('/test.txt', 'original');
      await fs.writeFile('/test.txt', 'updated');
      const content = await fs.readFile('/test.txt', { encoding: 'utf-8' });
      expect(content).toBe('updated');
    });
  });

  describe('appendFile', () => {
    it('should append to existing file', async () => {
      await fs.writeFile('/test.txt', 'Hello');
      await fs.appendFile('/test.txt', ', World!');
      const content = await fs.readFile('/test.txt', { encoding: 'utf-8' });
      expect(content).toBe('Hello, World!');
    });

    it('should create file if it does not exist', async () => {
      await fs.appendFile('/new.txt', 'content');
      const content = await fs.readFile('/new.txt', { encoding: 'utf-8' });
      expect(content).toBe('content');
    });
  });

  describe('deleteFile', () => {
    it('should delete a file', async () => {
      await fs.writeFile('/test.txt', 'content');
      await fs.deleteFile('/test.txt');
      expect(await fs.exists('/test.txt')).toBe(false);
    });

    it('should throw FileNotFoundError when deleting non-existent file', async () => {
      await expect(fs.deleteFile('/nonexistent.txt')).rejects.toThrow(FileNotFoundError);
    });

    it('should not throw when force is true', async () => {
      await expect(fs.deleteFile('/nonexistent.txt', { force: true })).resolves.not.toThrow();
    });

    it('should throw IsDirectoryError when deleting a directory', async () => {
      await fs.mkdir('/testdir');
      await expect(fs.deleteFile('/testdir')).rejects.toThrow(IsDirectoryError);
    });
  });

  describe('mkdir', () => {
    it('should create a directory', async () => {
      await fs.mkdir('/testdir');
      expect(await fs.isDirectory('/testdir')).toBe(true);
    });

    it('should create nested directories with recursive option', async () => {
      await fs.mkdir('/deep/nested/dir', { recursive: true });
      expect(await fs.isDirectory('/deep/nested/dir')).toBe(true);
    });

    it('should not throw if directory already exists', async () => {
      await fs.mkdir('/testdir');
      await expect(fs.mkdir('/testdir')).resolves.not.toThrow();
    });
  });

  describe('rmdir', () => {
    it('should remove an empty directory', async () => {
      await fs.mkdir('/testdir');
      await fs.rmdir('/testdir');
      expect(await fs.exists('/testdir')).toBe(false);
    });

    it('should throw DirectoryNotEmptyError for non-empty directory', async () => {
      await fs.mkdir('/testdir');
      await fs.writeFile('/testdir/file.txt', 'content');
      await expect(fs.rmdir('/testdir')).rejects.toThrow(DirectoryNotEmptyError);
    });

    it('should remove non-empty directory with recursive option', async () => {
      await fs.mkdir('/testdir');
      await fs.writeFile('/testdir/file.txt', 'content');
      await fs.rmdir('/testdir', { recursive: true });
      expect(await fs.exists('/testdir')).toBe(false);
    });

    it('should throw NotDirectoryError when removing a file', async () => {
      await fs.writeFile('/test.txt', 'content');
      await expect(fs.rmdir('/test.txt')).rejects.toThrow(NotDirectoryError);
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

    it('should filter by extension', async () => {
      await fs.writeFile('/dir/file.txt', 'text');
      await fs.writeFile('/dir/file.js', 'js');
      await fs.writeFile('/dir/file.ts', 'ts');

      const entries = await fs.readdir('/dir', { extension: '.txt' });
      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('file.txt');
    });

    it('should list recursively', async () => {
      await fs.writeFile('/dir/file1.txt', 'content1');
      await fs.writeFile('/dir/subdir/file2.txt', 'content2');

      const entries = await fs.readdir('/dir', { recursive: true });
      const names = entries.map((e) => e.name);
      expect(names).toContain('file1.txt');
      expect(names).toContain('subdir');
      expect(names).toContain('subdir/file2.txt');
    });

    it('should throw DirectoryNotFoundError for non-existent directory', async () => {
      await expect(fs.readdir('/nonexistent')).rejects.toThrow(DirectoryNotFoundError);
    });

    it('should throw NotDirectoryError when reading a file', async () => {
      await fs.writeFile('/test.txt', 'content');
      await expect(fs.readdir('/test.txt')).rejects.toThrow(NotDirectoryError);
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      await fs.writeFile('/test.txt', 'content');
      expect(await fs.exists('/test.txt')).toBe(true);
    });

    it('should return true for existing directory', async () => {
      await fs.mkdir('/testdir');
      expect(await fs.exists('/testdir')).toBe(true);
    });

    it('should return false for non-existent path', async () => {
      expect(await fs.exists('/nonexistent')).toBe(false);
    });
  });

  describe('stat', () => {
    it('should return file stats', async () => {
      await fs.writeFile('/test.txt', 'Hello, World!');
      const stat = await fs.stat('/test.txt');
      expect(stat.name).toBe('test.txt');
      expect(stat.type).toBe('file');
      expect(stat.size).toBe(13);
      expect(stat.mimeType).toBe('text/plain');
    });

    it('should return directory stats', async () => {
      await fs.mkdir('/testdir');
      const stat = await fs.stat('/testdir');
      expect(stat.name).toBe('testdir');
      expect(stat.type).toBe('directory');
    });
  });

  describe('copyFile', () => {
    it('should copy a file', async () => {
      await fs.writeFile('/source.txt', 'content');
      await fs.copyFile('/source.txt', '/dest.txt');
      
      const content = await fs.readFile('/dest.txt', { encoding: 'utf-8' });
      expect(content).toBe('content');
      expect(await fs.exists('/source.txt')).toBe(true);
    });

    it('should copy a directory recursively', async () => {
      await fs.writeFile('/src/file.txt', 'content');
      await fs.copyFile('/src', '/dest', { recursive: true });
      
      const content = await fs.readFile('/dest/file.txt', { encoding: 'utf-8' });
      expect(content).toBe('content');
    });
  });

  describe('moveFile', () => {
    it('should move a file', async () => {
      await fs.writeFile('/source.txt', 'content');
      await fs.moveFile('/source.txt', '/dest.txt');
      
      const content = await fs.readFile('/dest.txt', { encoding: 'utf-8' });
      expect(content).toBe('content');
      expect(await fs.exists('/source.txt')).toBe(false);
    });
  });

  describe('initial files', () => {
    it('should initialize with provided files', async () => {
      const fsWithFiles = createMemoryFilesystem({
        id: 'test-fs',
        provider: 'memory',
        initialFiles: {
          '/hello.txt': 'Hello!',
          '/data/config.json': '{"key": "value"}',
        },
      });

      await expect(fsWithFiles.readFile('/hello.txt', { encoding: 'utf-8' })).resolves.toBe('Hello!');
      await expect(fsWithFiles.readFile('/data/config.json', { encoding: 'utf-8' })).resolves.toBe('{"key": "value"}');
    });
  });
});
