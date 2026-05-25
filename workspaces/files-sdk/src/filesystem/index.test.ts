/**
 * FilesSDK Filesystem Provider Tests
 *
 * Tests FilesSDK-specific functionality including:
 * - Constructor options and ID generation
 * - File operations (read, write, append, delete, copy, move)
 * - Directory operations (mkdir, readdir, rmdir)
 * - Path operations (exists, stat)
 * - Read-only mode
 * - getInfo() / getInstructions()
 *
 * All tests mock the FilesSDK Files instance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { FilesSDKFilesystem } from './index';
import type { FilesSDKFilesystemOptions } from './index';

// ---------------------------------------------------------------------------
// Mock helpers — create a fake Files instance
// ---------------------------------------------------------------------------

function createMockStoredFile(key: string, data: Uint8Array | string, meta?: Record<string, unknown>) {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return {
    key,
    name: key.split('/').pop() ?? key,
    size: buf.byteLength,
    type: 'application/octet-stream',
    lastModified: new Date('2025-06-01T00:00:00Z'),
    etag: 'mock-etag',
    metadata: meta ?? {},
    arrayBuffer: vi.fn().mockResolvedValue(buf.buffer),
    text: vi.fn().mockResolvedValue(typeof data === 'string' ? data : new TextDecoder().decode(buf)),
    stream: vi.fn(),
    blob: vi.fn(),
  };
}

function createMockFiles() {
  return {
    upload: vi.fn().mockResolvedValue({ key: 'test', size: 0, contentType: 'application/octet-stream' }),
    download: vi.fn(),
    head: vi.fn(),
    exists: vi.fn().mockResolvedValue(false),
    delete: vi.fn().mockResolvedValue(undefined),
    copy: vi.fn().mockResolvedValue(undefined),
    move: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ items: [], cursor: undefined }),
    url: vi.fn(),
    signedUploadUrl: vi.fn(),
    file: vi.fn(),
    adapter: { name: 'mock' },
  };
}

function createFs(overrides: Partial<FilesSDKFilesystemOptions> = {}) {
  const mockFiles = createMockFiles();
  const fs = new FilesSDKFilesystem({
    files: mockFiles as any,
    ...overrides,
  });
  // Skip lifecycle init — set status to ready directly
  (fs as any).status = 'ready';
  return { fs, mockFiles };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FilesSDKFilesystem', () => {
  describe('Constructor & Options', () => {
    it('generates unique id if not provided', () => {
      const { fs: fs1 } = createFs();
      const { fs: fs2 } = createFs();

      expect(fs1.id).toMatch(/^files-sdk-/);
      expect(fs2.id).toMatch(/^files-sdk-/);
      expect(fs1.id).not.toBe(fs2.id);
    });

    it('uses provided id', () => {
      const { fs } = createFs({ id: 'my-custom-id' });

      expect(fs.id).toBe('my-custom-id');
    });

    it('sets readOnly from options', () => {
      const { fs: fsReadOnly } = createFs({ readOnly: true });
      const { fs: fsWritable } = createFs({ readOnly: false });
      const { fs: fsDefault } = createFs();

      expect(fsReadOnly.readOnly).toBe(true);
      expect(fsWritable.readOnly).toBe(false);
      expect(fsDefault.readOnly).toBeUndefined();
    });

    it('has correct provider and name', () => {
      const { fs } = createFs();

      expect(fs.provider).toBe('files-sdk');
      expect(fs.name).toBe('FilesSDKFilesystem');
    });

    it('status starts as pending before init', () => {
      const mockFiles = createMockFiles();
      const fs = new FilesSDKFilesystem({ files: mockFiles as any });

      expect(fs.status).toBe('pending');
    });

    it('sets displayName, icon, description from options', () => {
      const { fs } = createFs({
        displayName: 'My Storage',
        icon: 's3',
        description: 'Test description',
      });

      expect(fs.displayName).toBe('My Storage');
      expect(fs.icon).toBe('s3');
      expect(fs.description).toBe('Test description');
    });

    it('exposes the underlying Files instance', () => {
      const mockFiles = createMockFiles();
      const fs = new FilesSDKFilesystem({ files: mockFiles as any });

      expect(fs.files).toBe(mockFiles);
    });
  });

  describe('readFile()', () => {
    it('returns Buffer by default', async () => {
      const { fs, mockFiles } = createFs();
      mockFiles.download.mockResolvedValueOnce(createMockStoredFile('test.txt', 'hello'));

      const result = await fs.readFile('/test.txt');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe('hello');
    });

    it('returns string when encoding specified', async () => {
      const { fs, mockFiles } = createFs();
      mockFiles.download.mockResolvedValueOnce(createMockStoredFile('test.txt', 'hi'));

      const result = await fs.readFile('/test.txt', { encoding: 'utf-8' });

      expect(typeof result).toBe('string');
      expect(result).toBe('hi');
    });

    it('passes normalized key to download()', async () => {
      const { fs, mockFiles } = createFs();
      mockFiles.download.mockResolvedValueOnce(createMockStoredFile('test.txt', 'data'));

      await fs.readFile('/test.txt');

      expect(mockFiles.download).toHaveBeenCalledWith('test.txt');
    });

    it('throws FileNotFoundError on NotFound', async () => {
      const { fs, mockFiles } = createFs();
      const error = Object.assign(new Error('NotFound'), { code: 'NotFound' });
      mockFiles.download.mockRejectedValueOnce(error);

      await expect(fs.readFile('/missing.txt')).rejects.toThrow(/missing\.txt/);
    });

    it('re-throws non-NotFound errors', async () => {
      const { fs, mockFiles } = createFs();
      mockFiles.download.mockRejectedValueOnce(new Error('NetworkError'));

      await expect(fs.readFile('/test.txt')).rejects.toThrow('NetworkError');
    });
  });

  describe('writeFile()', () => {
    it('calls upload with string content', async () => {
      const { fs, mockFiles } = createFs();

      await fs.writeFile('/test.txt', 'hello world');

      expect(mockFiles.upload).toHaveBeenCalledWith('test.txt', expect.anything(), expect.objectContaining({ contentType: 'text/plain' }));
    });

    it('calls upload with Buffer content', async () => {
      const { fs, mockFiles } = createFs();

      await fs.writeFile('/data.bin', Buffer.from([1, 2, 3]));

      expect(mockFiles.upload).toHaveBeenCalledWith('data.bin', expect.any(Uint8Array), expect.objectContaining({ contentType: 'application/octet-stream' }));
    });

    it('detects MIME type from extension', async () => {
      const { fs, mockFiles } = createFs();

      await fs.writeFile('/page.html', '<html>');
      expect(mockFiles.upload).toHaveBeenCalledWith('page.html', expect.anything(), expect.objectContaining({ contentType: 'text/html' }));

      mockFiles.upload.mockClear();
      await fs.writeFile('/data.json', '{}');
      expect(mockFiles.upload).toHaveBeenCalledWith('data.json', expect.anything(), expect.objectContaining({ contentType: 'application/json' }));
    });

    it('respects mimeType option override', async () => {
      const { fs, mockFiles } = createFs();

      await fs.writeFile('/file.txt', 'data', { mimeType: 'text/csv' });

      expect(mockFiles.upload).toHaveBeenCalledWith('file.txt', expect.anything(), expect.objectContaining({ contentType: 'text/csv' }));
    });

    it('checks overwrite=false and throws FileExistsError', async () => {
      const { fs, mockFiles } = createFs();
      mockFiles.exists.mockResolvedValueOnce(true);

      await expect(fs.writeFile('/existing.txt', 'data', { overwrite: false })).rejects.toThrow(/existing\.txt/);
    });

    it('allows write when overwrite=false and file does not exist', async () => {
      const { fs, mockFiles } = createFs();
      mockFiles.exists.mockResolvedValueOnce(false);

      await fs.writeFile('/new.txt', 'data', { overwrite: false });

      expect(mockFiles.upload).toHaveBeenCalled();
    });
  });

  describe('appendFile()', () => {
    it('reads existing then writes concatenated content', async () => {
      const { fs, mockFiles } = createFs();
      mockFiles.download.mockResolvedValueOnce(createMockStoredFile('test.txt', 'hello '));

      await fs.appendFile('/test.txt', 'world');

      expect(mockFiles.download).toHaveBeenCalledWith('test.txt');
      expect(mockFiles.upload).toHaveBeenCalledTimes(1);
      // Verify the concatenated content
      const uploadCall = mockFiles.upload.mock.calls[0]!;
      const written = Buffer.from(uploadCall[1] as Uint8Array);
      expect(written.toString()).toBe('hello world');
    });

    it('creates file if it does not exist', async () => {
      const { fs, mockFiles } = createFs();
      const error = Object.assign(new Error('NotFound'), { code: 'NotFound' });
      mockFiles.download.mockRejectedValueOnce(error);

      await fs.appendFile('/new.txt', 'content');

      expect(mockFiles.upload).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteFile()', () => {
    it('calls delete for files', async () => {
      const { fs, mockFiles } = createFs();
      // isDirectory check returns empty (not a directory)
      mockFiles.list.mockResolvedValueOnce({ items: [], cursor: undefined });

      await fs.deleteFile('/test.txt');

      expect(mockFiles.delete).toHaveBeenCalledWith('test.txt');
    });

    it('delegates to rmdir for directories', async () => {
      const { fs, mockFiles } = createFs();
      // isDirectory check returns items (is a directory)
      mockFiles.list
        .mockResolvedValueOnce({ items: [{ key: 'dir/file.txt' }], cursor: undefined })
        // rmdir lists all keys
        .mockResolvedValueOnce({ items: [{ key: 'dir/file.txt' }], cursor: undefined });

      await fs.deleteFile('/dir', { recursive: true });

      // Should have called delete with array of keys (batch)
      expect(mockFiles.delete).toHaveBeenCalledWith(['dir/file.txt']);
    });

    it('swallows errors with force=true', async () => {
      const { fs, mockFiles } = createFs();
      // isDirectory check
      mockFiles.list.mockResolvedValueOnce({ items: [], cursor: undefined });
      // delete throws
      mockFiles.delete.mockRejectedValueOnce(new Error('fail'));

      // Should not throw
      await fs.deleteFile('/gone.txt', { force: true });
    });
  });

  describe('copyFile()', () => {
    it('calls copy with normalized keys', async () => {
      const { fs, mockFiles } = createFs();

      await fs.copyFile('/src.txt', '/dest.txt');

      expect(mockFiles.copy).toHaveBeenCalledWith('src.txt', 'dest.txt');
    });

    it('throws FileNotFoundError on NotFound', async () => {
      const { fs, mockFiles } = createFs();
      const error = Object.assign(new Error('NotFound'), { code: 'NotFound' });
      mockFiles.copy.mockRejectedValueOnce(error);

      await expect(fs.copyFile('/missing.txt', '/dest.txt')).rejects.toThrow(/missing\.txt/);
    });
  });

  describe('moveFile()', () => {
    it('copies then deletes source', async () => {
      const { fs, mockFiles } = createFs();

      await fs.moveFile('/src.txt', '/dest.txt');

      expect(mockFiles.copy).toHaveBeenCalledWith('src.txt', 'dest.txt');
      expect(mockFiles.delete).toHaveBeenCalledWith('src.txt');
    });

    it('throws FileNotFoundError on NotFound', async () => {
      const { fs, mockFiles } = createFs();
      const error = Object.assign(new Error('NotFound'), { code: 'NotFound' });
      mockFiles.copy.mockRejectedValueOnce(error);

      await expect(fs.moveFile('/missing.txt', '/dest.txt')).rejects.toThrow(/missing\.txt/);
    });
  });

  describe('mkdir()', () => {
    it('is a no-op (object storage)', async () => {
      const { fs, mockFiles } = createFs();

      await fs.mkdir('/newdir');

      // Should not call any file operations
      expect(mockFiles.upload).not.toHaveBeenCalled();
      expect(mockFiles.list).not.toHaveBeenCalled();
    });
  });

  describe('readdir()', () => {
    it('returns file entries from list()', async () => {
      const { fs, mockFiles } = createFs();
      mockFiles.list.mockResolvedValueOnce({
        items: [
          { key: 'dir/file1.txt', size: 100, type: 'text/plain' },
          { key: 'dir/file2.json', size: 200, type: 'application/json' },
        ],
        cursor: undefined,
      });

      const entries = await fs.readdir('/dir');

      expect(entries).toEqual([
        { name: 'file1.txt', type: 'file', size: 100 },
        { name: 'file2.json', type: 'file', size: 200 },
      ]);
    });

    it('synthesizes directory entries for nested keys', async () => {
      const { fs, mockFiles } = createFs();
      mockFiles.list.mockResolvedValueOnce({
        items: [
          { key: 'root/subdir/file.txt', size: 50, type: 'text/plain' },
          { key: 'root/subdir/other.txt', size: 60, type: 'text/plain' },
          { key: 'root/top.txt', size: 10, type: 'text/plain' },
        ],
        cursor: undefined,
      });

      const entries = await fs.readdir('/root');

      // Should have one directory entry (subdir) and one file entry (top.txt)
      expect(entries).toEqual([
        { name: 'subdir', type: 'directory' },
        { name: 'top.txt', type: 'file', size: 10 },
      ]);
    });

    it('deduplicates directory entries', async () => {
      const { fs, mockFiles } = createFs();
      mockFiles.list.mockResolvedValueOnce({
        items: [
          { key: 'root/sub/a.txt', size: 1 },
          { key: 'root/sub/b.txt', size: 2 },
        ],
        cursor: undefined,
      });

      const entries = await fs.readdir('/root');
      const dirs = entries.filter(e => e.type === 'directory');

      expect(dirs).toHaveLength(1);
      expect(dirs[0]!.name).toBe('sub');
    });

    it('filters by extension', async () => {
      const { fs, mockFiles } = createFs();
      mockFiles.list.mockResolvedValueOnce({
        items: [
          { key: 'dir/a.txt', size: 1 },
          { key: 'dir/b.json', size: 2 },
          { key: 'dir/c.txt', size: 3 },
        ],
        cursor: undefined,
      });

      const entries = await fs.readdir('/dir', { extension: '.txt' });

      expect(entries).toEqual([
        { name: 'a.txt', type: 'file', size: 1 },
        { name: 'c.txt', type: 'file', size: 3 },
      ]);
    });

    it('paginates across multiple pages', async () => {
      const { fs, mockFiles } = createFs();
      mockFiles.list
        .mockResolvedValueOnce({
          items: [{ key: 'dir/a.txt', size: 1 }],
          cursor: 'page2',
        })
        .mockResolvedValueOnce({
          items: [{ key: 'dir/b.txt', size: 2 }],
          cursor: undefined,
        });

      const entries = await fs.readdir('/dir');

      expect(entries).toHaveLength(2);
      expect(mockFiles.list).toHaveBeenCalledTimes(2);
    });
  });

  describe('rmdir()', () => {
    it('throws DirectoryNotEmptyError for non-recursive on non-empty dir', async () => {
      const { fs, mockFiles } = createFs();
      mockFiles.list.mockResolvedValueOnce({
        items: [{ key: 'dir/file.txt' }],
        cursor: undefined,
      });

      await expect(fs.rmdir('/dir')).rejects.toThrow();
    });

    it('batch-deletes all keys for recursive rmdir', async () => {
      const { fs, mockFiles } = createFs();
      mockFiles.list.mockResolvedValueOnce({
        items: [
          { key: 'dir/a.txt' },
          { key: 'dir/b.txt' },
          { key: 'dir/sub/c.txt' },
        ],
        cursor: undefined,
      });

      await fs.rmdir('/dir', { recursive: true });

      expect(mockFiles.delete).toHaveBeenCalledWith(['dir/a.txt', 'dir/b.txt', 'dir/sub/c.txt']);
    });

    it('no-ops if directory is already empty', async () => {
      const { fs, mockFiles } = createFs();
      mockFiles.list.mockResolvedValueOnce({ items: [], cursor: undefined });

      await fs.rmdir('/empty', { recursive: true });

      expect(mockFiles.delete).not.toHaveBeenCalled();
    });
  });

  describe('exists()', () => {
    it('returns true for root', async () => {
      const { fs } = createFs();

      expect(await fs.exists('/')).toBe(true);
      expect(await fs.exists('.')).toBe(true);
    });

    it('returns true when file exists', async () => {
      const { fs, mockFiles } = createFs();
      mockFiles.exists.mockResolvedValueOnce(true);

      expect(await fs.exists('/test.txt')).toBe(true);
    });

    it('checks as directory when file does not exist', async () => {
      const { fs, mockFiles } = createFs();
      mockFiles.exists.mockResolvedValueOnce(false);
      // isDirectory check: has children
      mockFiles.list.mockResolvedValueOnce({ items: [{ key: 'dir/child.txt' }], cursor: undefined });

      expect(await fs.exists('/dir')).toBe(true);
    });

    it('returns false when neither file nor directory', async () => {
      const { fs, mockFiles } = createFs();
      mockFiles.exists.mockResolvedValueOnce(false);
      mockFiles.list.mockResolvedValueOnce({ items: [], cursor: undefined });

      expect(await fs.exists('/nope')).toBe(false);
    });
  });

  describe('stat()', () => {
    it('returns directory stat for root', async () => {
      const { fs } = createFs();

      const st = await fs.stat('/');

      expect(st.type).toBe('directory');
      expect(st.name).toBe('/');
    });

    it('returns file stat from head()', async () => {
      const { fs, mockFiles } = createFs();
      mockFiles.head.mockResolvedValueOnce(
        createMockStoredFile('test.txt', 'hello'),
      );

      const st = await fs.stat('/test.txt');

      expect(st.type).toBe('file');
      expect(st.name).toBe('test.txt');
      expect(st.size).toBe(5);
    });

    it('returns directory stat when key is a directory', async () => {
      const { fs, mockFiles } = createFs();
      const error = Object.assign(new Error('NotFound'), { code: 'NotFound' });
      mockFiles.head.mockRejectedValueOnce(error);
      // isDirectory check
      mockFiles.list.mockResolvedValueOnce({ items: [{ key: 'dir/child.txt' }], cursor: undefined });

      const st = await fs.stat('/dir');

      expect(st.type).toBe('directory');
      expect(st.name).toBe('dir');
    });

    it('throws FileNotFoundError when nothing matches', async () => {
      const { fs, mockFiles } = createFs();
      const error = Object.assign(new Error('NotFound'), { code: 'NotFound' });
      mockFiles.head.mockRejectedValueOnce(error);
      mockFiles.list.mockResolvedValueOnce({ items: [], cursor: undefined });

      await expect(fs.stat('/nope')).rejects.toThrow(/nope/);
    });
  });

  describe('getInfo()', () => {
    it('returns correct metadata', () => {
      const { fs } = createFs({ id: 'my-id', readOnly: true, icon: 'r2' });

      const info = fs.getInfo();

      expect(info.id).toBe('my-id');
      expect(info.name).toBe('FilesSDKFilesystem');
      expect(info.provider).toBe('files-sdk');
      expect(info.readOnly).toBe(true);
      expect(info.icon).toBe('r2');
      expect(info.metadata).toEqual({ adapter: 'mock' });
    });
  });

  describe('getInstructions()', () => {
    it('includes adapter name', () => {
      const { fs } = createFs();

      const instructions = fs.getInstructions();

      expect(instructions).toContain('mock');
    });

    it('indicates read-only when set', () => {
      const { fs } = createFs({ readOnly: true });

      expect(fs.getInstructions()).toContain('read-only');
    });

    it('mentions persistent storage', () => {
      const { fs } = createFs();

      expect(fs.getInstructions()).toContain('Persistent');
    });
  });

  describe('Read-only mode', () => {
    it('throws on writeFile', async () => {
      const { fs } = createFs({ readOnly: true });

      await expect(fs.writeFile('/test.txt', 'data')).rejects.toThrow();
    });

    it('throws on deleteFile', async () => {
      const { fs } = createFs({ readOnly: true });

      await expect(fs.deleteFile('/test.txt')).rejects.toThrow();
    });

    it('throws on appendFile', async () => {
      const { fs } = createFs({ readOnly: true });

      await expect(fs.appendFile('/test.txt', 'data')).rejects.toThrow();
    });

    it('throws on copyFile', async () => {
      const { fs } = createFs({ readOnly: true });

      await expect(fs.copyFile('/a.txt', '/b.txt')).rejects.toThrow();
    });

    it('throws on moveFile', async () => {
      const { fs } = createFs({ readOnly: true });

      await expect(fs.moveFile('/a.txt', '/b.txt')).rejects.toThrow();
    });

    it('throws on rmdir', async () => {
      const { fs } = createFs({ readOnly: true });

      await expect(fs.rmdir('/dir', { recursive: true })).rejects.toThrow();
    });

    it('allows readFile', async () => {
      const { fs, mockFiles } = createFs({ readOnly: true });
      mockFiles.download.mockResolvedValueOnce(createMockStoredFile('test.txt', 'data'));

      const result = await fs.readFile('/test.txt');
      expect(result.toString()).toBe('data');
    });

    it('allows readdir', async () => {
      const { fs, mockFiles } = createFs({ readOnly: true });
      mockFiles.list.mockResolvedValueOnce({ items: [], cursor: undefined });

      const entries = await fs.readdir('/');
      expect(entries).toEqual([]);
    });

    it('allows exists', async () => {
      const { fs, mockFiles } = createFs({ readOnly: true });
      mockFiles.exists.mockResolvedValueOnce(true);

      expect(await fs.exists('/test.txt')).toBe(true);
    });

    it('allows stat', async () => {
      const { fs, mockFiles } = createFs({ readOnly: true });
      mockFiles.head.mockResolvedValueOnce(createMockStoredFile('test.txt', 'data'));

      const st = await fs.stat('/test.txt');
      expect(st.type).toBe('file');
    });
  });

  describe('init()', () => {
    it('verifies connectivity via list()', async () => {
      const { fs, mockFiles } = createFs();
      (fs as any).status = 'pending'; // Reset status

      await (fs as any).init();

      expect(mockFiles.list).toHaveBeenCalledWith({ limit: 1 });
    });

    it('throws on unauthorized error', async () => {
      const mockFiles = createMockFiles();
      const fs = new FilesSDKFilesystem({ files: mockFiles as any });
      const error = Object.assign(new Error('Unauthorized'), { code: 'Unauthorized' });
      mockFiles.list.mockRejectedValueOnce(error);

      await expect((fs as any).init()).rejects.toThrow(/Access denied/);
    });
  });
});
