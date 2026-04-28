/**
 * Azure Blob Store Unit Tests
 *
 * Tests AzureBlobStore functionality with a mocked Azure Storage Blob SDK.
 */

import type { StorageBlobEntry } from '@mastra/core/storage';
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface MockBlob {
  body: Buffer;
  metadata: Record<string, string>;
  contentType: string;
}

let mockContainer: Map<string, MockBlob>;
let lastServiceClientArgs: { url?: string; hasCredential?: boolean } | undefined;

vi.mock('@azure/storage-blob', () => {
  function makeBlockBlobClient(key: string) {
    return {
      uploadData: vi.fn(
        async (
          buffer: Buffer,
          options: { blobHTTPHeaders?: { blobContentType?: string }; metadata?: Record<string, string> },
        ) => {
          mockContainer.set(key, {
            body: Buffer.from(buffer),
            metadata: options?.metadata ?? {},
            contentType: options?.blobHTTPHeaders?.blobContentType ?? 'application/octet-stream',
          });
        },
      ),
      downloadToBuffer: vi.fn(async () => {
        const blob = mockContainer.get(key);
        if (!blob) {
          const err = new Error('BlobNotFound') as Error & { statusCode?: number };
          err.statusCode = 404;
          throw err;
        }
        return blob.body;
      }),
      getProperties: vi.fn(async () => {
        const blob = mockContainer.get(key);
        if (!blob) {
          const err = new Error('BlobNotFound') as Error & { statusCode?: number };
          err.statusCode = 404;
          throw err;
        }
        return { metadata: blob.metadata, contentType: blob.contentType };
      }),
      deleteIfExists: vi.fn(async () => {
        const existed = mockContainer.has(key);
        mockContainer.delete(key);
        return { succeeded: existed };
      }),
    };
  }

  const containerClient = {
    getBlockBlobClient: vi.fn((key: string) => makeBlockBlobClient(key)),
    getBlobClient: vi.fn((name: string) => ({ name })),
    getBlobBatchClient: vi.fn(() => ({
      deleteBlobs: vi.fn(async (blobClients: Array<{ name: string }>) => {
        for (const c of blobClients) mockContainer.delete(c.name);
      }),
    })),
    listBlobsFlat: vi.fn(({ prefix }: { prefix: string }) => ({
      async *[Symbol.asyncIterator]() {
        for (const name of mockContainer.keys()) {
          if (name.startsWith(prefix)) yield { name };
        }
      },
    })),
  };

  const serviceClient = {
    getContainerClient: vi.fn(() => containerClient),
  };

  return {
    BlobServiceClient: Object.assign(
      vi.fn().mockImplementation(function (url: string, credential?: unknown) {
        lastServiceClientArgs = { url, hasCredential: credential !== undefined };
        return serviceClient;
      }),
      {
        fromConnectionString: vi.fn(() => {
          lastServiceClientArgs = { url: 'connection-string' };
          return serviceClient;
        }),
      },
    ),
    StorageSharedKeyCredential: vi.fn().mockImplementation(function () {
      return {};
    }),
  };
});

import { AzureBlobStore } from './index';

function createEntry(hash: string, content: string, mimeType?: string): StorageBlobEntry {
  return {
    hash,
    content,
    size: Buffer.byteLength(content, 'utf-8'),
    mimeType,
    createdAt: new Date('2025-01-01T00:00:00Z'),
  };
}

function createStore(opts?: { prefix?: string }) {
  return new AzureBlobStore({
    container: 'test-container',
    connectionString:
      'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=key;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;',
    ...(opts?.prefix !== undefined ? { prefix: opts.prefix } : {}),
  });
}

describe('AzureBlobStore', () => {
  beforeEach(() => {
    mockContainer = new Map();
    lastServiceClientArgs = undefined;
  });

  describe('init', () => {
    it('should be a no-op (Azure does not require table creation)', async () => {
      const store = createStore();
      await expect(store.init()).resolves.toBeUndefined();
    });
  });

  describe('put', () => {
    it('should store a blob keyed by hash under the prefix', async () => {
      const store = createStore();
      const entry = createEntry('abc123', 'hello world', 'text/plain');

      await store.put(entry);

      const blob = mockContainer.get('mastra_skill_blobs/abc123');
      expect(blob).toBeDefined();
      expect(blob!.body.toString('utf-8')).toBe('hello world');
      expect(blob!.contentType).toBe('text/plain');
      expect(blob!.metadata.size).toBe(String(Buffer.byteLength('hello world', 'utf-8')));
      expect(blob!.metadata.createdat).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should use default content type when mimeType is not provided', async () => {
      const store = createStore();
      await store.put(createEntry('abc123', 'binary data'));

      const blob = mockContainer.get('mastra_skill_blobs/abc123');
      expect(blob!.contentType).toBe('application/octet-stream');
    });

    it('should use custom prefix', async () => {
      const store = createStore({ prefix: 'custom/blobs' });
      await store.put(createEntry('abc123', 'hello'));

      expect(mockContainer.has('custom/blobs/abc123')).toBe(true);
      expect(mockContainer.has('mastra_skill_blobs/abc123')).toBe(false);
    });

    it('should overwrite existing blob (idempotent for content-addressable storage)', async () => {
      const store = createStore();
      const entry = createEntry('abc123', 'hello world');

      await store.put(entry);
      await store.put(entry);

      expect(mockContainer.size).toBe(1);
    });
  });

  describe('get', () => {
    it('should retrieve a stored blob', async () => {
      const store = createStore();
      const entry = createEntry('abc123', 'hello world', 'text/plain');
      await store.put(entry);

      const result = await store.get('abc123');

      expect(result).not.toBeNull();
      expect(result!.hash).toBe('abc123');
      expect(result!.content).toBe('hello world');
      expect(result!.mimeType).toBe('text/plain');
      expect(result!.size).toBe(Buffer.byteLength('hello world', 'utf-8'));
      expect(result!.createdAt).toEqual(new Date('2025-01-01T00:00:00Z'));
    });

    it('should return null for non-existent blob', async () => {
      const store = createStore();

      const result = await store.get('nonexistent');

      expect(result).toBeNull();
    });

    it('should fall back to content length when metadata size is missing', async () => {
      const store = createStore();
      mockContainer.set('mastra_skill_blobs/abc123', {
        body: Buffer.from('hello', 'utf-8'),
        metadata: { createdat: '2025-01-01T00:00:00.000Z' },
        contentType: 'text/plain',
      });

      const result = await store.get('abc123');

      expect(result).not.toBeNull();
      expect(result!.size).toBe(Buffer.byteLength('hello', 'utf-8'));
    });
  });

  describe('has', () => {
    it('should return true for existing blob', async () => {
      const store = createStore();
      await store.put(createEntry('abc123', 'hello'));

      expect(await store.has('abc123')).toBe(true);
    });

    it('should return false for non-existent blob', async () => {
      const store = createStore();

      expect(await store.has('nonexistent')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete an existing blob and return true', async () => {
      const store = createStore();
      await store.put(createEntry('abc123', 'hello'));

      const result = await store.delete('abc123');

      expect(result).toBe(true);
      expect(mockContainer.has('mastra_skill_blobs/abc123')).toBe(false);
    });

    it('should return false for non-existent blob', async () => {
      const store = createStore();

      const result = await store.delete('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('putMany', () => {
    it('should store multiple blobs in parallel', async () => {
      const store = createStore();
      const entries = [
        createEntry('hash1', 'content1', 'text/plain'),
        createEntry('hash2', 'content2', 'text/markdown'),
        createEntry('hash3', 'content3'),
      ];

      await store.putMany(entries);

      expect(mockContainer.size).toBe(3);
      expect(mockContainer.get('mastra_skill_blobs/hash1')!.body.toString('utf-8')).toBe('content1');
      expect(mockContainer.get('mastra_skill_blobs/hash2')!.body.toString('utf-8')).toBe('content2');
      expect(mockContainer.get('mastra_skill_blobs/hash3')!.body.toString('utf-8')).toBe('content3');
    });

    it('should handle empty array', async () => {
      const store = createStore();

      await store.putMany([]);

      expect(mockContainer.size).toBe(0);
    });
  });

  describe('getMany', () => {
    it('should retrieve multiple blobs', async () => {
      const store = createStore();
      await store.put(createEntry('hash1', 'content1'));
      await store.put(createEntry('hash2', 'content2'));

      const result = await store.getMany(['hash1', 'hash2']);

      expect(result.size).toBe(2);
      expect(result.get('hash1')!.content).toBe('content1');
      expect(result.get('hash2')!.content).toBe('content2');
    });

    it('should omit missing blobs', async () => {
      const store = createStore();
      await store.put(createEntry('hash1', 'content1'));

      const result = await store.getMany(['hash1', 'missing']);

      expect(result.size).toBe(1);
      expect(result.has('hash1')).toBe(true);
      expect(result.has('missing')).toBe(false);
    });

    it('should handle empty array', async () => {
      const store = createStore();

      const result = await store.getMany([]);

      expect(result.size).toBe(0);
    });
  });

  describe('dangerouslyClearAll', () => {
    it('should delete all blobs with the prefix', async () => {
      const store = createStore();
      await store.put(createEntry('hash1', 'content1'));
      await store.put(createEntry('hash2', 'content2'));
      await store.put(createEntry('hash3', 'content3'));

      await store.dangerouslyClearAll();

      expect(mockContainer.size).toBe(0);
    });

    it('should not delete objects outside the prefix', async () => {
      const store = createStore();
      await store.put(createEntry('hash1', 'content1'));

      mockContainer.set('other/file.txt', {
        body: Buffer.from('other'),
        metadata: {},
        contentType: 'text/plain',
      });

      await store.dangerouslyClearAll();

      expect(mockContainer.size).toBe(1);
      expect(mockContainer.has('other/file.txt')).toBe(true);
    });
  });

  describe('auth strategy', () => {
    it('should use connectionString when provided', async () => {
      const store = new AzureBlobStore({
        container: 'test',
        connectionString:
          'DefaultEndpointsProtocol=https;AccountName=acc;AccountKey=key;EndpointSuffix=core.windows.net',
      });

      await store.has('trigger-client-creation');

      expect(lastServiceClientArgs?.url).toBe('connection-string');
    });

    it('should use accountName/accountKey when provided', async () => {
      const store = new AzureBlobStore({
        container: 'test',
        accountName: 'myaccount',
        accountKey: 'a2V5',
      });

      await store.has('trigger-client-creation');

      expect(lastServiceClientArgs?.url).toBe('https://myaccount.blob.core.windows.net');
      expect(lastServiceClientArgs?.hasCredential).toBe(true);
    });

    it('should throw when neither connectionString, accountName, nor endpoint is provided', async () => {
      const store = new AzureBlobStore({ container: 'test' });

      await expect(store.has('any')).rejects.toThrow(/connectionString.*accountName.*endpoint/);
    });
  });

  describe('prefix handling', () => {
    it('should default prefix to mastra_skill_blobs/', async () => {
      const store = createStore();
      await store.put(createEntry('abc', 'hello'));

      expect(mockContainer.has('mastra_skill_blobs/abc')).toBe(true);
    });

    it('should trim slashes from custom prefix', async () => {
      const store = createStore({ prefix: '/my/prefix/' });
      await store.put(createEntry('abc', 'hello'));

      expect(mockContainer.has('my/prefix/abc')).toBe(true);
    });
  });
});
