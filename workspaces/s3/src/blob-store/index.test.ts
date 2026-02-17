/**
 * S3 Blob Store Unit Tests
 *
 * Tests S3BlobStore functionality with mocked AWS SDK.
 * Integration tests with real S3/MinIO are in index.integration.test.ts.
 */

import type { StorageBlobEntry } from '@mastra/core/storage';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory store to simulate S3 bucket contents
let mockBucket: Map<string, { Body: string; Metadata: Record<string, string>; ContentType: string }>;
let mockSendFn: ReturnType<typeof vi.fn>;

vi.mock('@aws-sdk/client-s3', () => {
  function MockS3Client() {
    // @ts-expect-error - Mocking S3Client
    this.send = (...args: any[]) => mockSendFn(...args);
  }

  function makeCmdClass(type: string) {
    return function (this: any, input: any) {
      this._type = type;
      this.input = input;
    };
  }

  return {
    S3Client: MockS3Client,
    GetObjectCommand: makeCmdClass('Get'),
    PutObjectCommand: makeCmdClass('Put'),
    DeleteObjectCommand: makeCmdClass('Delete'),
    HeadObjectCommand: makeCmdClass('Head'),
    ListObjectsV2Command: makeCmdClass('List'),
    DeleteObjectsCommand: makeCmdClass('DeleteObjects'),
  };
});

import { S3BlobStore } from './index';

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
  return new S3BlobStore({
    bucket: 'test-bucket',
    region: 'us-east-1',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    ...(opts?.prefix !== undefined ? { prefix: opts.prefix } : {}),
  });
}

describe('S3BlobStore', () => {
  beforeEach(() => {
    mockBucket = new Map();

    mockSendFn = vi.fn().mockImplementation((cmd: any) => {
      const type = cmd._type;
      const input = cmd.input;

      if (type === 'Put') {
        mockBucket.set(input.Key, {
          Body: input.Body,
          Metadata: input.Metadata ?? {},
          ContentType: input.ContentType ?? 'application/octet-stream',
        });
        return Promise.resolve({});
      }

      if (type === 'Get') {
        const obj = mockBucket.get(input.Key);
        if (!obj) {
          const err = new Error('NoSuchKey');
          (err as any).name = 'NoSuchKey';
          return Promise.reject(err);
        }
        return Promise.resolve({
          Body: { transformToString: () => Promise.resolve(obj.Body) },
          Metadata: obj.Metadata,
          ContentType: obj.ContentType,
        });
      }

      if (type === 'Head') {
        if (!mockBucket.has(input.Key)) {
          const err = new Error('NotFound');
          (err as any).name = 'NotFound';
          return Promise.reject(err);
        }
        return Promise.resolve({});
      }

      if (type === 'Delete') {
        mockBucket.delete(input.Key);
        return Promise.resolve({});
      }

      if (type === 'List') {
        const prefix = input.Prefix ?? '';
        const keys = Array.from(mockBucket.keys()).filter(k => k.startsWith(prefix));
        return Promise.resolve({
          Contents: keys.map(k => ({ Key: k })),
          IsTruncated: false,
        });
      }

      if (type === 'DeleteObjects') {
        const objects = input.Delete?.Objects ?? [];
        for (const obj of objects) {
          if (obj.Key) mockBucket.delete(obj.Key);
        }
        return Promise.resolve({});
      }

      return Promise.resolve({});
    });
  });

  describe('init', () => {
    it('should be a no-op (S3 does not require table creation)', async () => {
      const store = createStore();
      await store.init();
      expect(mockSendFn).not.toHaveBeenCalled();
    });
  });

  describe('put', () => {
    it('should store a blob as an S3 object', async () => {
      const store = createStore();
      const entry = createEntry('abc123', 'hello world', 'text/plain');

      await store.put(entry);

      const obj = mockBucket.get('mastra_skill_blobs/abc123');
      expect(obj).toBeDefined();
      expect(obj!.Body).toBe('hello world');
      expect(obj!.ContentType).toBe('text/plain');
      expect(obj!.Metadata.size).toBe(String(Buffer.byteLength('hello world', 'utf-8')));
      expect(obj!.Metadata.createdat).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should use default content type when mimeType is not provided', async () => {
      const store = createStore();
      const entry = createEntry('abc123', 'binary data');

      await store.put(entry);

      const obj = mockBucket.get('mastra_skill_blobs/abc123');
      expect(obj!.ContentType).toBe('application/octet-stream');
    });

    it('should use custom prefix', async () => {
      const store = createStore({ prefix: 'custom/blobs' });
      const entry = createEntry('abc123', 'hello');

      await store.put(entry);

      expect(mockBucket.has('custom/blobs/abc123')).toBe(true);
      expect(mockBucket.has('mastra_skill_blobs/abc123')).toBe(false);
    });

    it('should overwrite existing blob (idempotent for content-addressable storage)', async () => {
      const store = createStore();
      const entry = createEntry('abc123', 'hello world');

      await store.put(entry);
      await store.put(entry);

      expect(mockBucket.size).toBe(1);
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
      // Directly put an object without the size metadata
      mockBucket.set('mastra_skill_blobs/abc123', {
        Body: 'hello',
        Metadata: { createdat: '2025-01-01T00:00:00.000Z' },
        ContentType: 'text/plain',
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
      expect(mockBucket.has('mastra_skill_blobs/abc123')).toBe(false);
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

      expect(mockBucket.size).toBe(3);
      expect(mockBucket.get('mastra_skill_blobs/hash1')!.Body).toBe('content1');
      expect(mockBucket.get('mastra_skill_blobs/hash2')!.Body).toBe('content2');
      expect(mockBucket.get('mastra_skill_blobs/hash3')!.Body).toBe('content3');
    });

    it('should handle empty array', async () => {
      const store = createStore();

      await store.putMany([]);

      expect(mockBucket.size).toBe(0);
      expect(mockSendFn).not.toHaveBeenCalled();
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

      expect(mockBucket.size).toBe(0);
    });

    it('should not delete objects outside the prefix', async () => {
      const store = createStore();
      await store.put(createEntry('hash1', 'content1'));

      // Put something outside the prefix directly
      mockBucket.set('other/file.txt', { Body: 'other', Metadata: {}, ContentType: 'text/plain' });

      await store.dangerouslyClearAll();

      expect(mockBucket.size).toBe(1);
      expect(mockBucket.has('other/file.txt')).toBe(true);
    });
  });

  describe('prefix handling', () => {
    it('should default prefix to mastra_skill_blobs/', async () => {
      const store = createStore();
      await store.put(createEntry('abc', 'hello'));

      expect(mockBucket.has('mastra_skill_blobs/abc')).toBe(true);
    });

    it('should trim slashes from custom prefix', async () => {
      const store = createStore({ prefix: '/my/prefix/' });
      await store.put(createEntry('abc', 'hello'));

      expect(mockBucket.has('my/prefix/abc')).toBe(true);
    });
  });
});
