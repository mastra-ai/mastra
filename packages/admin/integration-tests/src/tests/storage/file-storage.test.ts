import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { LocalFileStorage } from '../../setup/mock-file-storage.js';

describe('Local File Storage Integration Tests', () => {
  let storage: LocalFileStorage;
  let baseDir: string;

  beforeAll(async () => {
    // Create a unique test directory
    baseDir = `/tmp/mastra-file-storage-test-${Date.now()}`;
    await fs.mkdir(baseDir, { recursive: true });

    storage = new LocalFileStorage({ baseDir });
  });

  afterAll(async () => {
    // Cleanup test directory
    await fs.rm(baseDir, { recursive: true, force: true }).catch(() => {});
  });

  beforeEach(async () => {
    // Clear the test directory between tests
    try {
      const entries = await fs.readdir(baseDir);
      for (const entry of entries) {
        await fs.rm(path.join(baseDir, entry), { recursive: true, force: true });
      }
    } catch {
      // Directory might not exist yet
    }
  });

  describe('Write Operations', () => {
    it('should write string content to a file', async () => {
      const filePath = 'test/write-string.txt';
      const content = 'Hello, World!';

      await storage.write(filePath, content);

      const exists = await storage.exists(filePath);
      expect(exists).toBe(true);

      const readContent = await storage.read(filePath);
      expect(readContent.toString()).toBe(content);
    });

    it('should write buffer content to a file', async () => {
      const filePath = 'test/write-buffer.txt';
      const content = Buffer.from('Binary content', 'utf-8');

      await storage.write(filePath, content);

      const readContent = await storage.read(filePath);
      expect(readContent.equals(content)).toBe(true);
    });

    it('should create parent directories automatically', async () => {
      const filePath = 'deep/nested/directory/structure/file.txt';
      const content = 'Nested content';

      await storage.write(filePath, content);

      const exists = await storage.exists(filePath);
      expect(exists).toBe(true);
    });

    it('should overwrite existing files', async () => {
      const filePath = 'test/overwrite.txt';

      await storage.write(filePath, 'Original content');
      await storage.write(filePath, 'New content');

      const readContent = await storage.read(filePath);
      expect(readContent.toString()).toBe('New content');
    });

    it('should handle empty content', async () => {
      const filePath = 'test/empty.txt';

      await storage.write(filePath, '');

      const exists = await storage.exists(filePath);
      expect(exists).toBe(true);

      const readContent = await storage.read(filePath);
      expect(readContent.toString()).toBe('');
    });

    it('should handle special characters in content', async () => {
      const filePath = 'test/special.txt';
      const content = 'Special chars: äöü 日本語 🎉 \n\t"quotes"';

      await storage.write(filePath, content);

      const readContent = await storage.read(filePath);
      expect(readContent.toString()).toBe(content);
    });
  });

  describe('Append Operations', () => {
    it('should append content to existing file', async () => {
      const filePath = 'test/append.txt';

      await storage.write(filePath, 'Line 1\n');
      await storage.append(filePath, 'Line 2\n');

      const readContent = await storage.read(filePath);
      expect(readContent.toString()).toBe('Line 1\nLine 2\n');
    });

    it('should create file if it does not exist when appending', async () => {
      const filePath = 'test/append-new.txt';

      await storage.append(filePath, 'First line\n');

      const exists = await storage.exists(filePath);
      expect(exists).toBe(true);

      const readContent = await storage.read(filePath);
      expect(readContent.toString()).toBe('First line\n');
    });

    it('should handle multiple appends', async () => {
      const filePath = 'test/multi-append.txt';

      for (let i = 1; i <= 5; i++) {
        await storage.append(filePath, `Line ${i}\n`);
      }

      const readContent = await storage.read(filePath);
      expect(readContent.toString()).toBe('Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n');
    });
  });

  describe('Read Operations', () => {
    it('should read file content as buffer', async () => {
      const filePath = 'test/read.txt';
      const content = 'Read this content';

      await storage.write(filePath, content);

      const readContent = await storage.read(filePath);
      expect(Buffer.isBuffer(readContent)).toBe(true);
      expect(readContent.toString()).toBe(content);
    });

    it('should throw error when reading non-existent file', async () => {
      await expect(storage.read('non-existent-file.txt')).rejects.toThrow();
    });

    it('should handle large files', async () => {
      const filePath = 'test/large.txt';
      // Create 1MB of content
      const content = 'x'.repeat(1024 * 1024);

      await storage.write(filePath, content);

      const readContent = await storage.read(filePath);
      expect(readContent.length).toBe(1024 * 1024);
    });
  });

  describe('List Operations', () => {
    it('should list files in a directory', async () => {
      await storage.write('test-list/file1.txt', 'content 1');
      await storage.write('test-list/file2.txt', 'content 2');
      await storage.write('test-list/file3.txt', 'content 3');

      const files = await storage.list('test-list');

      expect(files.length).toBe(3);
    });

    it('should return file info with correct properties', async () => {
      await storage.write('test-info/file.txt', 'test content');

      const files = await storage.list('test-info');

      expect(files.length).toBe(1);
      expect(files[0].path).toBe('test-info/file.txt');
      expect(files[0].size).toBeGreaterThan(0);
      expect(files[0].lastModified).toBeInstanceOf(Date);
    });

    it('should return empty array for non-existent directory', async () => {
      const files = await storage.list('non-existent-dir');
      expect(files).toEqual([]);
    });

    it('should list files recursively', async () => {
      await storage.write('test-recursive/level1/file1.txt', 'content');
      await storage.write('test-recursive/level1/level2/file2.txt', 'content');
      await storage.write('test-recursive/level1/level2/level3/file3.txt', 'content');

      const files = await storage.list('test-recursive');

      expect(files.length).toBe(3);
    });

    it('should sort files by lastModified ascending', async () => {
      await storage.write('test-sort/file1.txt', 'content 1');
      await new Promise(resolve => setTimeout(resolve, 10));
      await storage.write('test-sort/file2.txt', 'content 2');
      await new Promise(resolve => setTimeout(resolve, 10));
      await storage.write('test-sort/file3.txt', 'content 3');

      const files = await storage.list('test-sort');

      // Files should be sorted oldest first
      expect(files[0].path).toContain('file1');
      expect(files[2].path).toContain('file3');
    });
  });

  describe('Delete Operations', () => {
    it('should delete an existing file', async () => {
      const filePath = 'test-delete/file.txt';
      await storage.write(filePath, 'content to delete');

      await storage.delete(filePath);

      const exists = await storage.exists(filePath);
      expect(exists).toBe(false);
    });

    it('should not throw when deleting non-existent file', async () => {
      await expect(storage.delete('non-existent.txt')).resolves.not.toThrow();
    });

    it('should only delete specified file', async () => {
      await storage.write('test-delete-only/file1.txt', 'keep');
      await storage.write('test-delete-only/file2.txt', 'delete');

      await storage.delete('test-delete-only/file2.txt');

      expect(await storage.exists('test-delete-only/file1.txt')).toBe(true);
      expect(await storage.exists('test-delete-only/file2.txt')).toBe(false);
    });
  });

  describe('Move Operations', () => {
    it('should move a file to new location', async () => {
      const fromPath = 'test-move/original.txt';
      const toPath = 'test-move/moved.txt';
      const content = 'content to move';

      await storage.write(fromPath, content);
      await storage.move(fromPath, toPath);

      expect(await storage.exists(fromPath)).toBe(false);
      expect(await storage.exists(toPath)).toBe(true);

      const readContent = await storage.read(toPath);
      expect(readContent.toString()).toBe(content);
    });

    it('should create target directory if it does not exist', async () => {
      const fromPath = 'test-move-create/file.txt';
      const toPath = 'test-move-create/new/nested/dir/file.txt';

      await storage.write(fromPath, 'content');
      await storage.move(fromPath, toPath);

      expect(await storage.exists(toPath)).toBe(true);
    });

    it('should overwrite existing file at destination', async () => {
      const fromPath = 'test-move-overwrite/source.txt';
      const toPath = 'test-move-overwrite/dest.txt';

      await storage.write(fromPath, 'new content');
      await storage.write(toPath, 'old content');

      await storage.move(fromPath, toPath);

      const readContent = await storage.read(toPath);
      expect(readContent.toString()).toBe('new content');
    });

    it('should throw when moving non-existent file', async () => {
      await expect(storage.move('non-existent.txt', 'dest.txt')).rejects.toThrow();
    });
  });

  describe('Exists Operations', () => {
    it('should return true for existing file', async () => {
      const filePath = 'test-exists/file.txt';
      await storage.write(filePath, 'content');

      expect(await storage.exists(filePath)).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      expect(await storage.exists('non-existent.txt')).toBe(false);
    });

    it('should return false after file is deleted', async () => {
      const filePath = 'test-exists-delete/file.txt';
      await storage.write(filePath, 'content');
      await storage.delete(filePath);

      expect(await storage.exists(filePath)).toBe(false);
    });
  });

  describe('File Paths', () => {
    it('should handle paths with leading slashes', async () => {
      const filePath = '/leading-slash/file.txt';
      await storage.write(filePath, 'content');

      // Should normalize the path
      expect(await storage.exists(filePath)).toBe(true);
    });

    it('should handle paths with multiple slashes', async () => {
      const filePath = 'multiple//slashes///file.txt';
      await storage.write(filePath, 'content');

      // Path.join normalizes these
      expect(await storage.exists('multiple/slashes/file.txt')).toBe(true);
    });

    it('should handle paths with dots', async () => {
      const filePath = 'dotted/./path/../normalized/file.txt';
      await storage.write(filePath, 'content');

      // Should resolve to normalized path
      expect(await storage.exists('dotted/normalized/file.txt')).toBe(true);
    });

    it('should handle filenames with special characters', async () => {
      const filePath = 'special/file-with_special.chars.txt';
      await storage.write(filePath, 'content');

      expect(await storage.exists(filePath)).toBe(true);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent writes to different files', async () => {
      const writePromises = [];

      for (let i = 0; i < 10; i++) {
        writePromises.push(storage.write(`concurrent/file-${i}.txt`, `content ${i}`));
      }

      await Promise.all(writePromises);

      const files = await storage.list('concurrent');
      expect(files.length).toBe(10);
    });

    it('should handle concurrent appends to same file', async () => {
      const filePath = 'concurrent-append/file.txt';
      const appendPromises = [];

      for (let i = 0; i < 5; i++) {
        appendPromises.push(storage.append(filePath, `line ${i}\n`));
      }

      await Promise.all(appendPromises);

      const content = await storage.read(filePath);
      const lines = content.toString().trim().split('\n');
      expect(lines.length).toBe(5);
    });

    it('should handle concurrent reads', async () => {
      const filePath = 'concurrent-read/file.txt';
      await storage.write(filePath, 'shared content');

      const readPromises = [];
      for (let i = 0; i < 10; i++) {
        readPromises.push(storage.read(filePath));
      }

      const results = await Promise.all(readPromises);

      for (const result of results) {
        expect(result.toString()).toBe('shared content');
      }
    });
  });

  describe('Storage Properties', () => {
    it('should return correct storage type', async () => {
      expect(storage.type).toBe('local');
    });

    it('should return correct base directory', async () => {
      expect(storage.getBaseDir()).toBe(baseDir);
    });
  });

  describe('File Size Tracking', () => {
    it('should report accurate file sizes', async () => {
      const content = 'x'.repeat(1000);
      await storage.write('size-test/file.txt', content);

      const files = await storage.list('size-test');

      expect(files[0].size).toBe(1000);
    });

    it('should update size after append', async () => {
      const filePath = 'size-append/file.txt';
      await storage.write(filePath, 'initial');

      let files = await storage.list('size-append');
      const initialSize = files[0].size;

      await storage.append(filePath, ' appended');

      files = await storage.list('size-append');
      expect(files[0].size).toBeGreaterThan(initialSize);
    });
  });
});
