/**
 * GCS Filesystem Provider Tests
 *
 * Tests GCS-specific functionality including:
 * - Constructor options and ID generation
 * - Service account key parsing
 * - getMountConfig() output
 * - getInfo() output
 *
 * Based on the Workspace Filesystem & Sandbox Test Plan.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GCSFilesystem } from './index';

// Mock the Google Cloud Storage SDK
vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn().mockImplementation(function () {
    return {
      bucket: vi.fn().mockReturnValue({
        file: vi.fn().mockReturnValue({
          download: vi.fn(),
          save: vi.fn(),
          delete: vi.fn(),
          copy: vi.fn(),
          exists: vi.fn(),
          getMetadata: vi.fn(),
        }),
        exists: vi.fn().mockResolvedValue([true]),
        getFiles: vi.fn().mockResolvedValue([[]]),
        deleteFiles: vi.fn(),
      }),
    };
  }),
}));

describe('GCSFilesystem', () => {
  describe('Constructor & Options', () => {
    it('generates unique id if not provided', () => {
      const fs1 = new GCSFilesystem({ bucket: 'test' });
      const fs2 = new GCSFilesystem({ bucket: 'test' });

      expect(fs1.id).toMatch(/^gcs-fs-/);
      expect(fs2.id).toMatch(/^gcs-fs-/);
      expect(fs1.id).not.toBe(fs2.id);
    });

    it('uses provided id', () => {
      const fs = new GCSFilesystem({ id: 'my-custom-id', bucket: 'test' });

      expect(fs.id).toBe('my-custom-id');
    });

    it('sets readOnly from options', () => {
      const fsReadOnly = new GCSFilesystem({ bucket: 'test', readOnly: true });
      const fsWritable = new GCSFilesystem({ bucket: 'test', readOnly: false });
      const fsDefault = new GCSFilesystem({ bucket: 'test' });

      expect(fsReadOnly.readOnly).toBe(true);
      expect(fsWritable.readOnly).toBe(false);
      expect(fsDefault.readOnly).toBeUndefined();
    });

    it('has correct provider and name', () => {
      const fs = new GCSFilesystem({ bucket: 'test' });

      expect(fs.provider).toBe('gcs');
      expect(fs.name).toBe('GCSFilesystem');
    });

    it('status starts as pending', () => {
      const fs = new GCSFilesystem({ bucket: 'test' });

      expect(fs.status).toBe('pending');
    });

    it('accepts credentials as object', () => {
      const credentials = {
        type: 'service_account',
        project_id: 'my-project',
        private_key_id: 'key-id',
        private_key: '-----BEGIN PRIVATE KEY-----\n...',
        client_email: 'test@my-project.iam.gserviceaccount.com',
      };

      const fs = new GCSFilesystem({
        bucket: 'test',
        projectId: 'my-project',
        credentials,
      });

      expect(fs.provider).toBe('gcs');
    });

    it('accepts credentials as path string', () => {
      const fs = new GCSFilesystem({
        bucket: 'test',
        projectId: 'my-project',
        credentials: '/path/to/service-account-key.json',
      });

      expect(fs.provider).toBe('gcs');
    });

    it('treats credentials string as file path, not JSON', () => {
      const credentialsJson = JSON.stringify({
        type: 'service_account',
        project_id: 'my-project',
        private_key: '-----BEGIN PRIVATE KEY-----\n...',
        client_email: 'test@my-project.iam.gserviceaccount.com',
      });

      // When a string is passed, it's treated as a file path (keyFilename)
      // not as a JSON string to be parsed
      const fs = new GCSFilesystem({
        bucket: 'test',
        credentials: credentialsJson,
      });

      // getMountConfig should NOT include serviceAccountKey since string credentials
      // are treated as paths (which can't be passed to sandboxes)
      const config = fs.getMountConfig();
      expect(config.serviceAccountKey).toBeUndefined();
    });
  });

  describe('Icon and Display Name', () => {
    it('has gcs icon by default', () => {
      const fs = new GCSFilesystem({ bucket: 'test' });

      expect(fs.icon).toBe('gcs');
    });

    it('uses provided icon', () => {
      const fs = new GCSFilesystem({ bucket: 'test', icon: 'google-cloud' });

      expect(fs.icon).toBe('google-cloud');
    });

    it('has Google Cloud Storage displayName by default', () => {
      const fs = new GCSFilesystem({ bucket: 'test' });

      expect(fs.displayName).toBe('Google Cloud Storage');
    });

    it('uses provided displayName', () => {
      const fs = new GCSFilesystem({ bucket: 'test', displayName: 'My GCS Bucket' });

      expect(fs.displayName).toBe('My GCS Bucket');
    });
  });

  describe('getMountConfig()', () => {
    it('returns GCSMountConfig with bucket', () => {
      const fs = new GCSFilesystem({ bucket: 'my-bucket' });

      const config = fs.getMountConfig();

      expect(config.type).toBe('gcs');
      expect(config.bucket).toBe('my-bucket');
    });

    it('includes serviceAccountKey if credentials object provided', () => {
      const credentials = {
        type: 'service_account',
        project_id: 'my-project',
        private_key: '-----BEGIN PRIVATE KEY-----\n...',
        client_email: 'test@my-project.iam.gserviceaccount.com',
      };

      const fs = new GCSFilesystem({
        bucket: 'test',
        credentials,
      });

      const config = fs.getMountConfig();

      expect(config.serviceAccountKey).toBeDefined();
      expect(JSON.parse(config.serviceAccountKey!)).toEqual(credentials);
    });

    it('does not include serviceAccountKey if credentials is path string', () => {
      const fs = new GCSFilesystem({
        bucket: 'test',
        credentials: '/path/to/key.json',
      });

      const config = fs.getMountConfig();

      // Path-based credentials can't be passed to sandboxes
      expect(config.serviceAccountKey).toBeUndefined();
    });

    it('does not include serviceAccountKey if no credentials', () => {
      const fs = new GCSFilesystem({ bucket: 'test' });

      const config = fs.getMountConfig();

      expect(config.serviceAccountKey).toBeUndefined();
    });
  });

  describe('getInfo()', () => {
    it('returns FilesystemInfo with all fields', () => {
      const fs = new GCSFilesystem({ id: 'test-id', bucket: 'my-bucket' });

      const info = fs.getInfo();

      expect(info.id).toBe('test-id');
      expect(info.name).toBe('GCSFilesystem');
      expect(info.provider).toBe('gcs');
      expect(info.status).toBe('pending');
      expect(info.icon).toBe('gcs');
    });

    it('metadata includes bucket', () => {
      const fs = new GCSFilesystem({ bucket: 'my-bucket' });

      const info = fs.getInfo();

      expect(info.metadata?.bucket).toBe('my-bucket');
    });

    it('metadata includes endpoint if set', () => {
      const fs = new GCSFilesystem({
        bucket: 'test',
        endpoint: 'http://localhost:4443',
      });

      const info = fs.getInfo();

      expect(info.metadata?.endpoint).toBe('http://localhost:4443');
    });

    it('metadata excludes endpoint if not set', () => {
      const fs = new GCSFilesystem({ bucket: 'test' });

      const info = fs.getInfo();

      expect(info.metadata?.endpoint).toBeUndefined();
    });

    it('metadata includes prefix if set', () => {
      const fs = new GCSFilesystem({
        bucket: 'test',
        prefix: 'workspace/data',
      });

      const info = fs.getInfo();

      expect(info.metadata?.prefix).toBe('workspace/data/');
    });
  });

  describe('getInstructions()', () => {
    it('returns description with bucket name', () => {
      const fs = new GCSFilesystem({ bucket: 'my-bucket' });

      const instructions = fs.getInstructions();

      expect(instructions).toContain('my-bucket');
      expect(instructions).toContain('Google Cloud Storage');
    });

    it('indicates read-only when set', () => {
      const fs = new GCSFilesystem({ bucket: 'test', readOnly: true });

      const instructions = fs.getInstructions();

      expect(instructions).toContain('Read-only');
    });

    it('indicates persistent when writable', () => {
      const fs = new GCSFilesystem({ bucket: 'test' });

      const instructions = fs.getInstructions();

      expect(instructions).toContain('Persistent');
    });
  });

  describe('GCS Client Configuration', () => {
    it('creates client lazily on first operation', async () => {
      const { Storage } = await import('@google-cloud/storage');
      const MockStorage = vi.mocked(Storage);

      // Clear any calls from previous tests
      MockStorage.mockClear();

      const fs = new GCSFilesystem({
        bucket: 'test',
        projectId: 'my-project',
      });

      // Constructor should NOT create the Storage client
      expect(MockStorage).not.toHaveBeenCalled();

      // Trigger a method that uses the client (readFile calls getReadyBucket -> getStorage)
      try {
        await fs.readFile('test.txt');
      } catch {
        // Expected to fail (mock doesn't return proper data), but client should be created
      }

      // Now the Storage client should have been created
      expect(MockStorage).toHaveBeenCalled();
    });
  });

  describe('Prefix Handling', () => {
    it('normalizes prefix - removes leading slashes', () => {
      const fs = new GCSFilesystem({
        bucket: 'test',
        prefix: '/foo/bar',
      });

      const info = fs.getInfo();
      expect(info.metadata?.prefix).toBe('foo/bar/');
    });

    it('normalizes prefix - removes trailing slashes', () => {
      const fs = new GCSFilesystem({
        bucket: 'test',
        prefix: 'foo/bar/',
      });

      const info = fs.getInfo();
      expect(info.metadata?.prefix).toBe('foo/bar/');
    });

    it('normalizes prefix - handles both leading and trailing', () => {
      const fs = new GCSFilesystem({
        bucket: 'test',
        prefix: '//foo/bar//',
      });

      const info = fs.getInfo();
      expect(info.metadata?.prefix).toBe('foo/bar/');
    });
  });
});

/**
 * SDK Operation Unit Tests
 *
 * These verify the correct GCS SDK methods are called with the right parameters,
 * error mapping (code 404 → FileNotFoundError), prefix handling, MIME types, and readdir logic.
 *
 * Integration tests (real GCS) are in index.integration.test.ts.
 */
describe('GCSFilesystem SDK Operations', () => {
  let fs: GCSFilesystem;
  let mockBucket: any;
  let mockFile: any;

  /**
   * Helper: configure mock file methods for a test.
   */
  function configureMockFile(overrides: Record<string, unknown> = {}) {
    for (const [key, value] of Object.entries(overrides)) {
      mockFile[key].mockReset();
      if (value instanceof Error) {
        mockFile[key].mockRejectedValueOnce(value);
      } else {
        mockFile[key].mockResolvedValueOnce(value);
      }
    }
    return mockFile;
  }

  beforeEach(() => {
    // Create mock file with all needed methods
    mockFile = {
      download: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      copy: vi.fn(),
      exists: vi.fn(),
      getMetadata: vi.fn(),
      name: '',
    };

    // Create mock bucket
    mockBucket = {
      file: vi.fn().mockReturnValue(mockFile),
      exists: vi.fn().mockResolvedValue([true]),
      getFiles: vi.fn().mockResolvedValue([[]]),
      deleteFiles: vi.fn().mockResolvedValue(undefined),
    };

    fs = new GCSFilesystem({
      bucket: 'test-bucket',
      credentials: { type: 'service_account', project_id: 'test' },
    });
    // Set up mock bucket directly (avoids Storage constructor issues with vi.mock).
    // Note: coupled to private field names — update if implementation renames them.
    (fs as any)._storage = {};
    (fs as any)._bucket = mockBucket;
    (fs as any).status = 'ready';
  });

  describe('readFile()', () => {
    it('returns Buffer by default', async () => {
      configureMockFile({ download: [Buffer.from('hello')] });

      const result = await fs.readFile('/test.txt');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe('hello');
    });

    it('returns string when encoding specified', async () => {
      configureMockFile({ download: [Buffer.from('hi')] });

      const result = await fs.readFile('/test.txt', { encoding: 'utf-8' });

      expect(typeof result).toBe('string');
      expect(result).toBe('hi');
    });

    it('throws FileNotFoundError on 404', async () => {
      const error = Object.assign(new Error('Not Found'), { code: 404 });
      configureMockFile({ download: error });

      await expect(fs.readFile('/missing.txt')).rejects.toThrow(/missing\.txt/);
    });

    it('re-throws non-404 errors', async () => {
      const error = Object.assign(new Error('Forbidden'), { code: 403 });
      configureMockFile({ download: error });

      await expect(fs.readFile('/test.txt')).rejects.toThrow('Forbidden');
    });

    it('applies prefix to key', async () => {
      const prefixMockFile = {
        download: vi.fn().mockResolvedValue([Buffer.from('data')]),
        save: vi.fn(),
        delete: vi.fn(),
        copy: vi.fn(),
        exists: vi.fn().mockResolvedValue([false]),
        getMetadata: vi.fn(),
        name: '',
      };
      const prefixMockBucket = {
        file: vi.fn().mockReturnValue(prefixMockFile),
        getFiles: vi.fn().mockResolvedValue([[]]),
        deleteFiles: vi.fn().mockResolvedValue(undefined),
      };
      const prefixFs = new GCSFilesystem({
        bucket: 'test-bucket',
        credentials: { type: 'service_account' },
        prefix: 'my-prefix',
      });
      (prefixFs as any)._storage = {};
      (prefixFs as any)._bucket = prefixMockBucket;
      (prefixFs as any).status = 'ready';

      await prefixFs.readFile('/file.txt');

      expect(prefixMockBucket.file).toHaveBeenCalledWith('my-prefix/file.txt');
    });
  });

  describe('writeFile()', () => {
    it('calls file.save with string content as Buffer', async () => {
      configureMockFile({ save: undefined });

      await fs.writeFile('/test.txt', 'hello world');

      expect(mockFile.save).toHaveBeenCalledWith(
        Buffer.from('hello world', 'utf-8'),
        expect.objectContaining({
          contentType: 'text/plain',
          resumable: false,
        }),
      );
    });

    it('detects MIME type from extension', async () => {
      const mockFile = mockBucket.file();

      mockFile.save.mockResolvedValueOnce(undefined);
      await fs.writeFile('/page.html', '<html>');
      expect(mockFile.save).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({ contentType: 'text/html' }),
      );

      // Clear accumulated calls so assertion below only checks the JSON write
      mockFile.save.mockClear();
      mockFile.save.mockResolvedValueOnce(undefined);
      await fs.writeFile('/data.json', '{}');
      expect(mockFile.save).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({ contentType: 'application/json' }),
      );
    });

    it('applies prefix to key', async () => {
      const prefixMockFile = {
        download: vi.fn(),
        save: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn(),
        copy: vi.fn(),
        exists: vi.fn().mockResolvedValue([false]),
        getMetadata: vi.fn(),
        name: '',
      };
      const prefixMockBucket = {
        file: vi.fn().mockReturnValue(prefixMockFile),
        getFiles: vi.fn().mockResolvedValue([[]]),
        deleteFiles: vi.fn().mockResolvedValue(undefined),
      };
      const prefixFs = new GCSFilesystem({
        bucket: 'b',
        credentials: { type: 'service_account' },
        prefix: 'pfx',
      });
      (prefixFs as any)._storage = {};
      (prefixFs as any)._bucket = prefixMockBucket;
      (prefixFs as any).status = 'ready';

      await prefixFs.writeFile('/file.txt', 'data');

      expect(prefixMockBucket.file).toHaveBeenCalledWith('pfx/file.txt');
    });
  });

  describe('appendFile()', () => {
    it('reads existing content then writes concatenated result', async () => {
      const mockFile = mockBucket.file();
      // read existing
      mockFile.download.mockResolvedValueOnce([Buffer.from('hello ')]);
      // write result
      mockFile.save.mockResolvedValueOnce(undefined);

      await fs.appendFile('/test.txt', 'world');

      expect(mockFile.save).toHaveBeenCalledWith(Buffer.from('hello world', 'utf-8'), expect.any(Object));
    });

    it('creates file if it does not exist', async () => {
      const mockFile = mockBucket.file();
      // read fails (file doesn't exist)
      mockFile.download.mockRejectedValueOnce(Object.assign(new Error('Not Found'), { code: 404 }));
      // write new content
      mockFile.save.mockResolvedValueOnce(undefined);

      await fs.appendFile('/new.txt', 'content');

      expect(mockFile.save).toHaveBeenCalled();
    });
  });

  describe('deleteFile()', () => {
    it('calls file.delete() for files', async () => {
      const mockFile = mockBucket.file();
      // isDirectory: getFiles returns empty (not a directory)
      mockBucket.getFiles.mockResolvedValueOnce([[]]);
      // file.delete succeeds
      mockFile.delete.mockResolvedValueOnce(undefined);

      await fs.deleteFile('/test.txt');

      expect(mockFile.delete).toHaveBeenCalled();
    });

    it('throws FileNotFoundError on 404 without force', async () => {
      const mockFile = mockBucket.file();
      mockBucket.getFiles.mockResolvedValueOnce([[]]);
      mockFile.delete.mockRejectedValueOnce(Object.assign(new Error('Not Found'), { code: 404 }));

      await expect(fs.deleteFile('/missing.txt')).rejects.toThrow(/missing\.txt/);
    });

    it('swallows errors with force option', async () => {
      const mockFile = mockBucket.file();
      mockBucket.getFiles.mockResolvedValueOnce([[]]);
      mockFile.delete.mockRejectedValueOnce(Object.assign(new Error('Not Found'), { code: 404 }));

      await expect(fs.deleteFile('/missing.txt', { force: true })).resolves.not.toThrow();
    });

    it('delegates to rmdir for directories', async () => {
      // isDirectory: getFiles returns files (is a directory)
      mockBucket.getFiles.mockResolvedValueOnce([[{ name: 'dir/file.txt' }]]);
      // rmdir: deleteFiles
      mockBucket.deleteFiles.mockResolvedValueOnce(undefined);

      await fs.deleteFile('/dir');

      expect(mockBucket.deleteFiles).toHaveBeenCalledWith(expect.objectContaining({ prefix: 'dir/' }));
    });
  });

  describe('copyFile()', () => {
    it('calls srcFile.copy(destFile) with distinct file objects', async () => {
      const destFile = {
        copy: vi.fn(),
        download: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
        exists: vi.fn(),
        getMetadata: vi.fn(),
        name: 'dest.txt',
      };
      const srcFile = {
        copy: vi.fn().mockResolvedValueOnce(undefined),
        download: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
        exists: vi.fn(),
        getMetadata: vi.fn(),
        name: 'src.txt',
      };
      mockBucket.file.mockImplementation((key: string) => (key === 'src.txt' ? srcFile : destFile));

      await fs.copyFile('/src.txt', '/dest.txt');

      expect(mockBucket.file).toHaveBeenCalledWith('src.txt');
      expect(mockBucket.file).toHaveBeenCalledWith('dest.txt');
      expect(srcFile.copy).toHaveBeenCalledWith(destFile);
    });

    it('throws FileNotFoundError on 404', async () => {
      mockFile.copy.mockRejectedValueOnce(Object.assign(new Error('Not Found'), { code: 404 }));

      await expect(fs.copyFile('/missing.txt', '/dest.txt')).rejects.toThrow(/missing\.txt/);
    });
  });

  describe('moveFile()', () => {
    it('copies then deletes source', async () => {
      const mockFile = mockBucket.file();
      // copy
      mockFile.copy.mockResolvedValueOnce(undefined);
      // deleteFile → isDirectory check
      mockBucket.getFiles.mockResolvedValueOnce([[]]);
      // deleteFile → file.delete (with force: true)
      mockFile.delete.mockResolvedValueOnce(undefined);

      await fs.moveFile('/src.txt', '/dest.txt');

      expect(mockFile.copy).toHaveBeenCalled();
      expect(mockFile.delete).toHaveBeenCalled();
    });
  });

  describe('mkdir()', () => {
    it('is a no-op (GCS has no real directories)', async () => {
      await fs.mkdir('/new-dir');

      // No SDK calls should be made
      expect(mockBucket.file).not.toHaveBeenCalled();
    });
  });

  describe('rmdir()', () => {
    it('throws if non-recursive and directory is not empty', async () => {
      // getFiles with maxResults:1 returns a file → not empty
      mockBucket.getFiles.mockResolvedValueOnce([[{ name: 'dir/file.txt' }]]);

      await expect(fs.rmdir('/dir')).rejects.toThrow('Directory not empty');
    });

    it('recursive calls bucket.deleteFiles with prefix', async () => {
      mockBucket.deleteFiles.mockResolvedValueOnce(undefined);

      await fs.rmdir('/dir', { recursive: true });

      expect(mockBucket.deleteFiles).toHaveBeenCalledWith({ prefix: 'dir/' });
    });
  });

  describe('readdir()', () => {
    it('returns files with metadata', async () => {
      mockBucket.getFiles.mockResolvedValueOnce([
        [
          { name: 'file1.txt', metadata: { size: 100 } },
          { name: 'file2.js', metadata: { size: 200 } },
        ],
      ]);

      const entries = await fs.readdir('/');

      expect(entries).toEqual([
        { name: 'file1.txt', type: 'file', size: 100 },
        { name: 'file2.js', type: 'file', size: 200 },
      ]);
    });

    it('infers directories from nested paths in non-recursive mode', async () => {
      mockBucket.getFiles.mockResolvedValueOnce([
        [
          { name: 'subdir/file.txt', metadata: { size: 50 } },
          { name: 'top.txt', metadata: { size: 10 } },
        ],
      ]);

      const entries = await fs.readdir('/');

      expect(entries).toContainEqual({ name: 'subdir', type: 'directory' });
      expect(entries).toContainEqual({ name: 'top.txt', type: 'file', size: 10 });
    });

    it('recognizes directory markers (trailing slash)', async () => {
      mockBucket.getFiles.mockResolvedValueOnce([
        [
          { name: 'mydir/', metadata: { size: 0 } },
          { name: 'file.txt', metadata: { size: 50 } },
        ],
      ]);

      const entries = await fs.readdir('/');

      expect(entries).toContainEqual({ name: 'mydir', type: 'directory' });
      expect(entries).toContainEqual({ name: 'file.txt', type: 'file', size: 50 });
    });

    it('filters by extension', async () => {
      mockBucket.getFiles.mockResolvedValueOnce([
        [
          { name: 'a.txt', metadata: { size: 1 } },
          { name: 'b.ts', metadata: { size: 2 } },
        ],
      ]);

      const entries = await fs.readdir('/', { extension: '.ts' });

      expect(entries).toHaveLength(1);
      expect(entries[0]!.name).toBe('b.ts');
    });

    it('deduplicates directory entries', async () => {
      mockBucket.getFiles.mockResolvedValueOnce([
        [
          { name: 'dir/a.txt', metadata: { size: 1 } },
          { name: 'dir/b.txt', metadata: { size: 2 } },
        ],
      ]);

      const entries = await fs.readdir('/');

      const dirEntries = entries.filter(e => e.name === 'dir');
      expect(dirEntries).toHaveLength(1);
    });
  });

  describe('root path handling', () => {
    it('exists("/") returns true without calling bucket.file', async () => {
      const result = await fs.exists('/');
      expect(result).toBe(true);
      // Should not call bucket.file('') which would throw
      expect(mockBucket.file).not.toHaveBeenCalled();
    });

    it('stat("/") returns directory stat', async () => {
      const stat = await fs.stat('/');
      expect(stat.type).toBe('directory');
      expect(stat.path).toBe('/');
    });

    it('isFile("/") returns false', async () => {
      const result = await fs.isFile('/');
      expect(result).toBe(false);
    });

    it('isDirectory("/") returns true', async () => {
      const result = await fs.isDirectory('/');
      expect(result).toBe(true);
    });
  });

  describe('exists()', () => {
    it('returns true when file exists', async () => {
      const mockFile = mockBucket.file();
      mockFile.exists.mockResolvedValueOnce([true]);

      const result = await fs.exists('/test.txt');

      expect(result).toBe(true);
    });

    it('returns true when directory exists', async () => {
      const mockFile = mockBucket.file();
      mockFile.exists.mockResolvedValueOnce([false]); // not a file
      mockBucket.getFiles.mockResolvedValueOnce([[{ name: 'dir/file.txt' }]]); // has contents

      const result = await fs.exists('/dir');

      expect(result).toBe(true);
    });

    it('returns false when nothing exists', async () => {
      const mockFile = mockBucket.file();
      mockFile.exists.mockResolvedValueOnce([false]);
      mockBucket.getFiles.mockResolvedValueOnce([[]]);

      const result = await fs.exists('/missing');

      expect(result).toBe(false);
    });
  });

  describe('stat()', () => {
    it('returns file stat from metadata', async () => {
      const mockFile = mockBucket.file();
      mockFile.exists.mockResolvedValueOnce([true]);
      mockFile.getMetadata.mockResolvedValueOnce([
        {
          size: 1024,
          timeCreated: '2024-01-15T10:30:00Z',
          updated: '2024-01-16T12:00:00Z',
        },
      ]);

      const stat = await fs.stat('/docs/readme.txt');

      expect(stat).toEqual({
        name: 'readme.txt',
        path: '/docs/readme.txt',
        type: 'file',
        size: 1024,
        createdAt: new Date('2024-01-15T10:30:00Z'),
        modifiedAt: new Date('2024-01-16T12:00:00Z'),
      });
    });

    it('returns directory stat when file not found but prefix exists', async () => {
      const mockFile = mockBucket.file();
      mockFile.exists.mockResolvedValueOnce([false]);
      // isDirectory: has contents
      mockBucket.getFiles.mockResolvedValueOnce([[{ name: 'mydir/file.txt' }]]);

      const stat = await fs.stat('/mydir');

      expect(stat.type).toBe('directory');
      expect(stat.name).toBe('mydir');
      expect(stat.size).toBe(0);
    });

    it('throws FileNotFoundError when nothing exists', async () => {
      const mockFile = mockBucket.file();
      mockFile.exists.mockResolvedValueOnce([false]);
      mockBucket.getFiles.mockResolvedValueOnce([[]]);

      await expect(fs.stat('/missing')).rejects.toThrow(/missing/);
    });
  });
});
