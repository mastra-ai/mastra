/**
 * Azure Blob Filesystem Provider Tests
 *
 * Tests Azure-specific functionality including:
 * - Constructor options and ID generation
 * - Auth strategy selection
 * - getMountConfig() output
 * - getInfo() output
 * - SDK operation mapping and error handling
 */

import { Readable } from 'node:stream';

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AzureBlobFilesystem } from './index';

// Mock the Azure Storage Blob SDK
vi.mock('@azure/storage-blob', () => {
  const mockBlockBlobClient = {
    download: vi.fn(),
    upload: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    getProperties: vi.fn(),
    url: 'https://account.blob.core.windows.net/container/blob',
  };

  const mockBlobClient = {
    delete: vi.fn(),
    exists: vi.fn(),
    getProperties: vi.fn(),
  };

  const mockContainerClient = {
    getBlockBlobClient: vi.fn().mockReturnValue(mockBlockBlobClient),
    getBlobClient: vi.fn().mockReturnValue(mockBlobClient),
    getBlobBatchClient: vi.fn().mockReturnValue({ deleteBlobs: vi.fn() }),
    listBlobsFlat: vi.fn().mockReturnValue({ next: vi.fn().mockResolvedValue({ done: true }) }),
    listBlobsByHierarchy: vi.fn().mockReturnValue({
      [Symbol.asyncIterator]: () => ({ next: vi.fn().mockResolvedValue({ done: true }) }),
    }),
    exists: vi.fn().mockResolvedValue(true),
  };

  const mockServiceClient = {
    getContainerClient: vi.fn().mockReturnValue(mockContainerClient),
  };

  return {
    BlobSASPermissions: {
      parse: vi.fn().mockReturnValue({ toString: () => 'r' }),
    },
    BlobServiceClient: Object.assign(
      vi.fn().mockImplementation(function () {
        return mockServiceClient;
      }),
      { fromConnectionString: vi.fn().mockReturnValue(mockServiceClient) },
    ),
    StorageSharedKeyCredential: vi.fn().mockImplementation(function () {
      return {};
    }),
  };
});

function createReadableStream(data: Buffer): NodeJS.ReadableStream {
  return Readable.from([data]);
}

describe('AzureBlobFilesystem', () => {
  describe('Constructor & Options', () => {
    it('generates unique id if not provided', () => {
      const fs1 = new AzureBlobFilesystem({ container: 'test' });
      const fs2 = new AzureBlobFilesystem({ container: 'test' });

      expect(fs1.id).toMatch(/^azure-fs-/);
      expect(fs2.id).toMatch(/^azure-fs-/);
      expect(fs1.id).not.toBe(fs2.id);
    });

    it('uses provided id', () => {
      const fs = new AzureBlobFilesystem({ id: 'my-custom-id', container: 'test' });
      expect(fs.id).toBe('my-custom-id');
    });

    it('sets readOnly from options', () => {
      const fsReadOnly = new AzureBlobFilesystem({ container: 'test', readOnly: true });
      const fsWritable = new AzureBlobFilesystem({ container: 'test', readOnly: false });
      const fsDefault = new AzureBlobFilesystem({ container: 'test' });

      expect(fsReadOnly.readOnly).toBe(true);
      expect(fsWritable.readOnly).toBe(false);
      expect(fsDefault.readOnly).toBeUndefined();
    });

    it('has correct provider and name', () => {
      const fs = new AzureBlobFilesystem({ container: 'test' });

      expect(fs.provider).toBe('azure-blob');
      expect(fs.name).toBe('AzureBlobFilesystem');
    });

    it('status starts as pending', () => {
      const fs = new AzureBlobFilesystem({ container: 'test' });
      expect(fs.status).toBe('pending');
    });
  });

  describe('Icon and Display Name', () => {
    it('has azure-blob icon by default', () => {
      const fs = new AzureBlobFilesystem({ container: 'test' });
      expect(fs.icon).toBe('azure-blob');
    });

    it('uses provided icon', () => {
      const fs = new AzureBlobFilesystem({ container: 'test', icon: 'azure' });
      expect(fs.icon).toBe('azure');
    });

    it('has Azure Blob Storage displayName by default', () => {
      const fs = new AzureBlobFilesystem({ container: 'test' });
      expect(fs.displayName).toBe('Azure Blob Storage');
    });

    it('uses provided displayName', () => {
      const fs = new AzureBlobFilesystem({ container: 'test', displayName: 'My Azure Storage' });
      expect(fs.displayName).toBe('My Azure Storage');
    });
  });

  describe('getMountConfig()', () => {
    it('returns config with container', () => {
      const fs = new AzureBlobFilesystem({ container: 'my-container' });
      const config = fs.getMountConfig();

      expect(config.type).toBe('azure-blob');
      expect(config.container).toBe('my-container');
    });

    it('includes accountName and accountKey when provided', () => {
      const fs = new AzureBlobFilesystem({
        container: 'test',
        accountName: 'myaccount',
        accountKey: 'mykey',
      });
      const config = fs.getMountConfig();

      expect(config.accountName).toBe('myaccount');
      expect(config.accountKey).toBe('mykey');
    });

    it('includes connectionString when provided', () => {
      const connStr = 'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=abc;';
      const fs = new AzureBlobFilesystem({
        container: 'test',
        connectionString: connStr,
      });
      const config = fs.getMountConfig();

      expect(config.connectionString).toBe(connStr);
    });

    it('does not include auth fields when using DefaultAzureCredential', () => {
      const fs = new AzureBlobFilesystem({
        container: 'test',
        accountName: 'myaccount',
        useDefaultCredential: true,
      });
      const config = fs.getMountConfig();

      expect(config.accountName).toBe('myaccount');
      expect(config.accountKey).toBeUndefined();
      expect(config.connectionString).toBeUndefined();
    });

    it('includes normalized prefix when provided', () => {
      const fs = new AzureBlobFilesystem({ container: 'test', prefix: '//workspace/data//' });
      const config = fs.getMountConfig();

      expect(config.prefix).toBe('workspace/data/');
    });
  });

  describe('getInfo()', () => {
    it('returns FilesystemInfo with all fields', () => {
      const fs = new AzureBlobFilesystem({ id: 'test-id', container: 'my-container' });
      const info = fs.getInfo();

      expect(info.id).toBe('test-id');
      expect(info.name).toBe('AzureBlobFilesystem');
      expect(info.provider).toBe('azure-blob');
      expect(info.status).toBe('pending');
      expect(info.icon).toBe('azure-blob');
    });

    it('metadata includes container', () => {
      const fs = new AzureBlobFilesystem({ container: 'my-container' });
      const info = fs.getInfo();

      expect(info.metadata?.container).toBe('my-container');
    });

    it('metadata includes endpoint if set', () => {
      const fs = new AzureBlobFilesystem({
        container: 'test',
        endpoint: 'http://localhost:10000',
      });
      const info = fs.getInfo();

      expect(info.metadata?.endpoint).toBe('http://localhost:10000');
    });

    it('metadata excludes endpoint if not set', () => {
      const fs = new AzureBlobFilesystem({ container: 'test' });
      const info = fs.getInfo();

      expect(info.metadata?.endpoint).toBeUndefined();
    });

    it('metadata includes prefix if set', () => {
      const fs = new AzureBlobFilesystem({
        container: 'test',
        prefix: 'workspace/data',
      });
      const info = fs.getInfo();

      expect(info.metadata?.prefix).toBe('workspace/data/');
    });
  });

  describe('getInstructions()', () => {
    it('returns description with container name', () => {
      const fs = new AzureBlobFilesystem({ container: 'my-container' });
      const instructions = fs.getInstructions();

      expect(instructions).toContain('my-container');
      expect(instructions).toContain('Azure Blob Storage');
    });

    it('indicates read-only when set', () => {
      const fs = new AzureBlobFilesystem({ container: 'test', readOnly: true });
      expect(fs.getInstructions()).toContain('Read-only');
    });

    it('indicates persistent when writable', () => {
      const fs = new AzureBlobFilesystem({ container: 'test' });
      expect(fs.getInstructions()).toContain('Persistent');
    });
  });

  describe('ReadOnly Enforcement', () => {
    it('throws PermissionError on writeFile when readOnly', async () => {
      const fs = new AzureBlobFilesystem({
        container: 'test',
        connectionString: 'fake',
        readOnly: true,
      });
      await expect(fs.writeFile('/test.txt', 'content')).rejects.toThrow(/read-only/);
    });

    it('throws PermissionError on appendFile when readOnly', async () => {
      const fs = new AzureBlobFilesystem({
        container: 'test',
        connectionString: 'fake',
        readOnly: true,
      });
      await expect(fs.appendFile('/test.txt', 'content')).rejects.toThrow(/read-only/);
    });

    it('throws PermissionError on deleteFile when readOnly', async () => {
      const fs = new AzureBlobFilesystem({
        container: 'test',
        connectionString: 'fake',
        readOnly: true,
      });
      await expect(fs.deleteFile('/test.txt')).rejects.toThrow(/read-only/);
    });

    it('throws PermissionError on copyFile when readOnly', async () => {
      const fs = new AzureBlobFilesystem({
        container: 'test',
        connectionString: 'fake',
        readOnly: true,
      });
      await expect(fs.copyFile('/src.txt', '/dest.txt')).rejects.toThrow(/read-only/);
    });

    it('throws PermissionError on moveFile when readOnly', async () => {
      const fs = new AzureBlobFilesystem({
        container: 'test',
        connectionString: 'fake',
        readOnly: true,
      });
      await expect(fs.moveFile('/src.txt', '/dest.txt')).rejects.toThrow(/read-only/);
    });

    it('allows mkdir when readOnly because Azure directories are implicit', async () => {
      const fs = new AzureBlobFilesystem({
        container: 'test',
        connectionString: 'fake',
        readOnly: true,
      });
      await expect(fs.mkdir('/new-dir')).resolves.not.toThrow();
    });

    it('throws PermissionError on rmdir when readOnly', async () => {
      const fs = new AzureBlobFilesystem({
        container: 'test',
        connectionString: 'fake',
        readOnly: true,
      });
      await expect(fs.rmdir('/dir')).rejects.toThrow(/read-only/);
    });

    it('does not throw on read operations when readOnly', () => {
      const fs = new AzureBlobFilesystem({
        container: 'test',
        connectionString: 'fake',
        readOnly: true,
      });
      // Constructor and sync accessors should not throw
      expect(fs.readOnly).toBe(true);
      expect(fs.getInfo().readOnly).toBe(true);
    });
  });

  describe('Prefix Handling', () => {
    it('normalizes prefix - removes leading slashes', () => {
      const fs = new AzureBlobFilesystem({ container: 'test', prefix: '/foo/bar' });
      expect(fs.getInfo().metadata?.prefix).toBe('foo/bar/');
    });

    it('normalizes prefix - removes trailing slashes', () => {
      const fs = new AzureBlobFilesystem({ container: 'test', prefix: 'foo/bar/' });
      expect(fs.getInfo().metadata?.prefix).toBe('foo/bar/');
    });

    it('normalizes prefix - handles both leading and trailing', () => {
      const fs = new AzureBlobFilesystem({ container: 'test', prefix: '//foo/bar//' });
      expect(fs.getInfo().metadata?.prefix).toBe('foo/bar/');
    });
  });

  describe('Auth Strategy Selection', () => {
    it('uses connectionString when provided', async () => {
      const { BlobServiceClient } = await import('@azure/storage-blob');
      const MockBlobServiceClient = vi.mocked(BlobServiceClient);
      MockBlobServiceClient.fromConnectionString.mockClear();

      const fs = new AzureBlobFilesystem({
        container: 'test',
        connectionString: 'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=abc;',
      });

      // Access container to trigger client creation
      await fs.getContainer();

      expect(MockBlobServiceClient.fromConnectionString).toHaveBeenCalled();
    });

    it('uses StorageSharedKeyCredential when accountName and accountKey provided', async () => {
      const { StorageSharedKeyCredential } = await import('@azure/storage-blob');
      const MockCredential = vi.mocked(StorageSharedKeyCredential);
      MockCredential.mockClear();

      const fs = new AzureBlobFilesystem({
        container: 'test',
        accountName: 'myaccount',
        accountKey: 'mykey',
      });

      await fs.getContainer();

      expect(MockCredential).toHaveBeenCalledWith('myaccount', 'mykey');
    });
  });
});

/**
 * SDK Operation Unit Tests
 *
 * Verify correct Azure SDK methods are called with right parameters,
 * error mapping (statusCode 404 → FileNotFoundError), prefix handling, and readdir logic.
 */
describe('AzureBlobFilesystem SDK Operations', () => {
  let fs: AzureBlobFilesystem;
  let mockContainerClient: any;
  let mockBlockBlobClient: any;
  let mockBlobClient: any;

  beforeEach(() => {
    mockBlockBlobClient = {
      download: vi.fn(),
      upload: vi.fn(),
      url: 'https://test.blob.core.windows.net/test/blob',
    };

    mockBlobClient = {
      delete: vi.fn(),
      exists: vi.fn(),
      getProperties: vi.fn(),
      generateSasUrl: vi.fn(),
      syncCopyFromURL: vi.fn(),
      beginCopyFromURL: vi.fn(),
      getBlockBlobClient: vi.fn().mockReturnValue(mockBlockBlobClient),
    };

    mockContainerClient = {
      getBlockBlobClient: vi.fn().mockReturnValue(mockBlockBlobClient),
      getBlobClient: vi.fn().mockReturnValue(mockBlobClient),
      getBlobBatchClient: vi.fn().mockReturnValue({ deleteBlobs: vi.fn().mockResolvedValue({}) }),
      listBlobsFlat: vi.fn(),
      listBlobsByHierarchy: vi.fn(),
      exists: vi.fn().mockResolvedValue(true),
    };

    fs = new AzureBlobFilesystem({
      container: 'test-container',
      connectionString: 'fake-connection-string',
    });
    (fs as any)._containerClient = mockContainerClient;
    (fs as any).status = 'ready';
  });

  describe('readFile()', () => {
    it('returns Buffer by default', async () => {
      mockBlockBlobClient.download.mockResolvedValueOnce({
        readableStreamBody: createReadableStream(Buffer.from('hello')),
      });

      const result = await fs.readFile('/test.txt');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe('hello');
    });

    it('returns string when encoding specified', async () => {
      mockBlockBlobClient.download.mockResolvedValueOnce({
        readableStreamBody: createReadableStream(Buffer.from('hi')),
      });

      const result = await fs.readFile('/test.txt', { encoding: 'utf-8' });

      expect(typeof result).toBe('string');
      expect(result).toBe('hi');
    });

    it('throws FileNotFoundError on 404', async () => {
      const error = Object.assign(new Error('BlobNotFound'), { statusCode: 404 });
      mockBlockBlobClient.download.mockRejectedValueOnce(error);

      await expect(fs.readFile('/missing.txt')).rejects.toThrow(/missing\.txt/);
    });

    it('re-throws non-404 errors', async () => {
      const error = Object.assign(new Error('Forbidden'), { statusCode: 403 });
      mockBlockBlobClient.download.mockRejectedValueOnce(error);

      await expect(fs.readFile('/test.txt')).rejects.toThrow('Forbidden');
    });

    it('applies prefix to key', async () => {
      const prefixBlockBlobClient = {
        download: vi.fn().mockResolvedValue({
          readableStreamBody: createReadableStream(Buffer.from('data')),
        }),
        upload: vi.fn(),
      };
      const prefixBlobClient = {
        exists: vi.fn().mockResolvedValue(false),
        delete: vi.fn(),
        getProperties: vi.fn(),
      };
      const prefixContainerClient = {
        getBlockBlobClient: vi.fn().mockReturnValue(prefixBlockBlobClient),
        getBlobClient: vi.fn().mockReturnValue(prefixBlobClient),
        listBlobsFlat: vi.fn().mockReturnValue({ next: vi.fn().mockResolvedValue({ done: true }) }),
        listBlobsByHierarchy: vi.fn(),
      };
      const prefixFs = new AzureBlobFilesystem({
        container: 'test',
        connectionString: 'fake',
        prefix: 'my-prefix',
      });
      (prefixFs as any)._containerClient = prefixContainerClient;
      (prefixFs as any).status = 'ready';

      await prefixFs.readFile('/file.txt');

      expect(prefixContainerClient.getBlockBlobClient).toHaveBeenCalledWith('my-prefix/file.txt');
    });
  });

  describe('writeFile()', () => {
    it('calls upload with string content as Buffer', async () => {
      mockBlockBlobClient.upload.mockResolvedValueOnce({});

      await fs.writeFile('/test.txt', 'hello world');

      expect(mockBlockBlobClient.upload).toHaveBeenCalledWith(
        Buffer.from('hello world', 'utf-8'),
        11,
        expect.objectContaining({
          blobHTTPHeaders: { blobContentType: 'text/plain' },
        }),
      );
    });

    it('detects MIME type from extension', async () => {
      mockBlockBlobClient.upload.mockResolvedValue({});

      await fs.writeFile('/page.html', '<html>');
      expect(mockBlockBlobClient.upload).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.any(Number),
        expect.objectContaining({ blobHTTPHeaders: { blobContentType: 'text/html' } }),
      );

      mockBlockBlobClient.upload.mockClear();
      await fs.writeFile('/data.json', '{}');
      expect(mockBlockBlobClient.upload).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.any(Number),
        expect.objectContaining({ blobHTTPHeaders: { blobContentType: 'application/json' } }),
      );
    });
  });

  describe('appendFile()', () => {
    it('reads existing content then writes concatenated result', async () => {
      mockBlockBlobClient.download.mockResolvedValueOnce({
        readableStreamBody: createReadableStream(Buffer.from('hello ')),
      });
      mockBlockBlobClient.upload.mockResolvedValueOnce({});

      await fs.appendFile('/test.txt', 'world');

      expect(mockBlockBlobClient.upload).toHaveBeenCalledWith(
        Buffer.from('hello world', 'utf-8'),
        expect.any(Number),
        expect.any(Object),
      );
    });

    it('creates file if it does not exist', async () => {
      const error = Object.assign(new Error('BlobNotFound'), { statusCode: 404 });
      mockBlockBlobClient.download.mockRejectedValueOnce(error);
      mockBlockBlobClient.upload.mockResolvedValueOnce({});

      await fs.appendFile('/new.txt', 'content');

      expect(mockBlockBlobClient.upload).toHaveBeenCalled();
    });

    it('preserves binary bytes when appending Buffer to Buffer', async () => {
      // Non-UTF-8 bytes that would be corrupted by string decoding (e.g., 0xFF, 0xFE, 0x00)
      const existing = Buffer.from([0xff, 0xfe, 0x00, 0x01]);
      const toAppend = Buffer.from([0x80, 0x81, 0x82]);
      const expected = Buffer.concat([existing, toAppend]);

      mockBlockBlobClient.download.mockResolvedValueOnce({
        readableStreamBody: createReadableStream(existing),
      });
      mockBlockBlobClient.upload.mockResolvedValueOnce({});

      await fs.appendFile('/binary.bin', toAppend);

      const uploadCall = mockBlockBlobClient.upload.mock.calls[0]!;
      const uploadedBuffer = uploadCall[0] as Buffer;
      expect(Buffer.isBuffer(uploadedBuffer)).toBe(true);
      expect(uploadedBuffer.equals(expected)).toBe(true);
    });
  });

  describe('deleteFile()', () => {
    it('calls blobClient.delete() for files', async () => {
      // isDirectory check: listBlobsFlat returns empty
      mockContainerClient.listBlobsFlat.mockReturnValueOnce({
        next: vi.fn().mockResolvedValue({ done: true }),
      });
      mockBlobClient.delete.mockResolvedValueOnce({});

      await fs.deleteFile('/test.txt');

      expect(mockBlobClient.delete).toHaveBeenCalled();
    });

    it('throws FileNotFoundError on 404 without force', async () => {
      mockContainerClient.listBlobsFlat.mockReturnValueOnce({
        next: vi.fn().mockResolvedValue({ done: true }),
      });
      const error = Object.assign(new Error('BlobNotFound'), { statusCode: 404 });
      mockBlobClient.delete.mockRejectedValueOnce(error);

      await expect(fs.deleteFile('/missing.txt')).rejects.toThrow(/missing\.txt/);
    });

    it('silently succeeds on 404 when force is true', async () => {
      mockContainerClient.listBlobsFlat.mockReturnValueOnce({
        next: vi.fn().mockResolvedValue({ done: true }),
      });
      const error = Object.assign(new Error('BlobNotFound'), { statusCode: 404 });
      mockBlobClient.delete.mockRejectedValueOnce(error);

      await expect(fs.deleteFile('/missing.txt', { force: true })).resolves.not.toThrow();
    });

    it('still throws non-404 errors even when force is true', async () => {
      mockContainerClient.listBlobsFlat.mockReturnValueOnce({
        next: vi.fn().mockResolvedValue({ done: true }),
      });
      const error = Object.assign(new Error('Forbidden'), { statusCode: 403 });
      mockBlobClient.delete.mockRejectedValueOnce(error);

      await expect(fs.deleteFile('/forbidden.txt', { force: true })).rejects.toThrow('Forbidden');
    });
  });

  describe('copyFile()', () => {
    it('uses server-side copy via SAS URL for non-empty blobs', async () => {
      mockBlobClient.generateSasUrl.mockResolvedValueOnce('https://account.blob.core.windows.net/c/src?sas=token');
      mockBlobClient.getProperties.mockResolvedValueOnce({ contentLength: 1024 });
      mockBlobClient.syncCopyFromURL.mockResolvedValueOnce({});

      await fs.copyFile('/src.txt', '/dest.txt');

      expect(mockBlobClient.generateSasUrl).toHaveBeenCalled();
      expect(mockBlobClient.syncCopyFromURL).toHaveBeenCalled();
    });

    it('uses beginCopyFromURL for blobs over 256MB', async () => {
      const poller = { pollUntilDone: vi.fn().mockResolvedValue({}) };
      mockBlobClient.generateSasUrl.mockResolvedValueOnce('https://account.blob.core.windows.net/c/src?sas=token');
      mockBlobClient.getProperties.mockResolvedValueOnce({ contentLength: 300 * 1024 * 1024 });
      mockBlobClient.beginCopyFromURL.mockResolvedValueOnce(poller);

      await fs.copyFile('/large.bin', '/large-copy.bin');

      expect(mockBlobClient.beginCopyFromURL).toHaveBeenCalled();
      expect(poller.pollUntilDone).toHaveBeenCalled();
    });

    it('handles zero-length blobs with direct upload', async () => {
      mockBlobClient.generateSasUrl.mockResolvedValueOnce('https://account.blob.core.windows.net/c/src?sas=token');
      mockBlobClient.getProperties.mockResolvedValueOnce({ contentLength: 0 });
      mockBlockBlobClient.upload.mockResolvedValueOnce({});

      await fs.copyFile('/empty.txt', '/empty-copy.txt');

      expect(mockBlobClient.syncCopyFromURL).not.toHaveBeenCalled();
      expect(mockBlockBlobClient.upload).toHaveBeenCalledWith(Buffer.alloc(0), 0);
    });

    it('falls back to download+reupload when SAS generation is unsupported', async () => {
      mockBlobClient.generateSasUrl.mockRejectedValueOnce(
        new Error('generateSasUrl is only supported with StorageSharedKeyCredential'),
      );
      mockBlockBlobClient.download.mockResolvedValueOnce({
        readableStreamBody: createReadableStream(Buffer.from('content')),
      });
      mockBlockBlobClient.upload.mockResolvedValueOnce({});

      await fs.copyFile('/src.txt', '/dest.txt');

      expect(mockBlockBlobClient.download).toHaveBeenCalled();
      expect(mockBlockBlobClient.upload).toHaveBeenCalled();
    });

    it('falls back to download+reupload for the Azure SDK shared key error', async () => {
      mockBlobClient.generateSasUrl.mockRejectedValueOnce(
        new RangeError('Can only generate the SAS when the client is initialized with a shared key credential'),
      );
      mockBlockBlobClient.download.mockResolvedValueOnce({
        readableStreamBody: createReadableStream(Buffer.from('content')),
      });
      mockBlockBlobClient.upload.mockResolvedValueOnce({});

      await fs.copyFile('/src.txt', '/dest.txt');

      expect(mockBlockBlobClient.download).toHaveBeenCalled();
      expect(mockBlockBlobClient.upload).toHaveBeenCalled();
    });

    it('throws FileNotFoundError when source does not exist', async () => {
      const error = Object.assign(new Error('BlobNotFound'), { statusCode: 404 });
      mockBlobClient.generateSasUrl.mockRejectedValueOnce(error);

      await expect(fs.copyFile('/missing.txt', '/dest.txt')).rejects.toThrow(/missing\.txt/);
    });
  });

  describe('mkdir()', () => {
    it('is a no-op', async () => {
      await fs.mkdir('/new-dir');
      expect(mockContainerClient.getBlockBlobClient).not.toHaveBeenCalled();
      expect(mockContainerClient.getBlobClient).not.toHaveBeenCalled();
    });
  });

  describe('rmdir()', () => {
    it('throws if non-recursive and directory is not empty', async () => {
      mockContainerClient.listBlobsFlat.mockReturnValueOnce({
        next: vi.fn().mockResolvedValue({ done: false, value: { name: 'dir/file.txt' } }),
      });

      await expect(fs.rmdir('/dir')).rejects.toThrow('Directory not empty');
    });

    it('recursive deletes all blobs with prefix using Azure batch delete', async () => {
      const blobs = [{ name: 'dir/a.txt' }, { name: 'dir/b.txt' }];
      const mockBatchClient = { deleteBlobs: vi.fn().mockResolvedValue({}) };
      mockContainerClient.listBlobsFlat.mockReturnValueOnce({
        [Symbol.asyncIterator]: () => {
          let i = 0;
          return {
            next: () =>
              Promise.resolve(i < blobs.length ? { done: false, value: blobs[i++] } : { done: true, value: undefined }),
          };
        },
      });
      mockContainerClient.getBlobBatchClient.mockReturnValueOnce(mockBatchClient);

      await fs.rmdir('/dir', { recursive: true });

      expect(mockContainerClient.getBlobClient).toHaveBeenCalledWith('dir/a.txt');
      expect(mockContainerClient.getBlobClient).toHaveBeenCalledWith('dir/b.txt');
      expect(mockBatchClient.deleteBlobs).toHaveBeenCalledWith([mockBlobClient, mockBlobClient]);
    });
  });

  describe('readdir()', () => {
    it('returns files from hierarchical listing', async () => {
      const items = [
        { kind: 'blob', name: 'file1.txt', properties: { contentLength: 100 } },
        { kind: 'blob', name: 'file2.js', properties: { contentLength: 200 } },
      ];
      mockContainerClient.listBlobsByHierarchy.mockReturnValueOnce({
        [Symbol.asyncIterator]: () => {
          let i = 0;
          return {
            next: () =>
              Promise.resolve(i < items.length ? { done: false, value: items[i++] } : { done: true, value: undefined }),
          };
        },
      });

      const entries = await fs.readdir('/');

      expect(entries).toEqual([
        { name: 'file1.txt', type: 'file', size: 100 },
        { name: 'file2.js', type: 'file', size: 200 },
      ]);
    });

    it('returns directories from prefix items', async () => {
      const items = [
        { kind: 'prefix', name: 'subdir/' },
        { kind: 'blob', name: 'top.txt', properties: { contentLength: 10 } },
      ];
      mockContainerClient.listBlobsByHierarchy.mockReturnValueOnce({
        [Symbol.asyncIterator]: () => {
          let i = 0;
          return {
            next: () =>
              Promise.resolve(i < items.length ? { done: false, value: items[i++] } : { done: true, value: undefined }),
          };
        },
      });

      const entries = await fs.readdir('/');

      expect(entries).toContainEqual({ name: 'subdir', type: 'directory' });
      expect(entries).toContainEqual({ name: 'top.txt', type: 'file', size: 10 });
    });

    it('filters by extension', async () => {
      const items = [
        { kind: 'blob', name: 'a.txt', properties: { contentLength: 1 } },
        { kind: 'blob', name: 'b.ts', properties: { contentLength: 2 } },
      ];
      mockContainerClient.listBlobsByHierarchy.mockReturnValueOnce({
        [Symbol.asyncIterator]: () => {
          let i = 0;
          return {
            next: () =>
              Promise.resolve(i < items.length ? { done: false, value: items[i++] } : { done: true, value: undefined }),
          };
        },
      });

      const entries = await fs.readdir('/', { extension: '.ts' });

      expect(entries).toHaveLength(1);
      expect(entries[0]!.name).toBe('b.ts');
    });
  });

  describe('root path handling', () => {
    it('exists("/") returns true without calling blob client', async () => {
      const result = await fs.exists('/');
      expect(result).toBe(true);
      expect(mockContainerClient.getBlobClient).not.toHaveBeenCalled();
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
      mockBlobClient.exists.mockResolvedValueOnce(true);

      const result = await fs.exists('/test.txt');
      expect(result).toBe(true);
    });

    it('returns true when directory exists', async () => {
      mockBlobClient.exists.mockResolvedValueOnce(false);
      mockContainerClient.listBlobsFlat.mockReturnValueOnce({
        next: vi.fn().mockResolvedValue({ done: false, value: { name: 'dir/file.txt' } }),
      });

      const result = await fs.exists('/dir');
      expect(result).toBe(true);
    });

    it('returns false when nothing exists', async () => {
      mockBlobClient.exists.mockResolvedValueOnce(false);
      mockContainerClient.listBlobsFlat.mockReturnValueOnce({
        next: vi.fn().mockResolvedValue({ done: true }),
      });

      const result = await fs.exists('/missing');
      expect(result).toBe(false);
    });
  });

  describe('stat()', () => {
    it('returns file stat from properties', async () => {
      mockBlobClient.getProperties.mockResolvedValueOnce({
        contentLength: 1024,
        createdOn: new Date('2024-01-15T10:30:00Z'),
        lastModified: new Date('2024-01-16T12:00:00Z'),
      });

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
      const error = Object.assign(new Error('BlobNotFound'), { statusCode: 404 });
      mockBlobClient.getProperties.mockRejectedValueOnce(error);
      // isDirectory returns true
      mockContainerClient.listBlobsFlat.mockReturnValueOnce({
        next: vi.fn().mockResolvedValue({ done: false, value: { name: 'mydir/file.txt' } }),
      });

      const stat = await fs.stat('/mydir');

      expect(stat.type).toBe('directory');
      expect(stat.name).toBe('mydir');
      expect(stat.size).toBe(0);
    });

    it('throws FileNotFoundError when nothing exists', async () => {
      const error = Object.assign(new Error('BlobNotFound'), { statusCode: 404 });
      mockBlobClient.getProperties.mockRejectedValueOnce(error);
      mockContainerClient.listBlobsFlat.mockReturnValueOnce({
        next: vi.fn().mockResolvedValue({ done: true }),
      });

      await expect(fs.stat('/missing')).rejects.toThrow(/missing/);
    });
  });
});
