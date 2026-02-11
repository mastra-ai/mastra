/**
 * S3 Filesystem Provider Tests
 *
 * Tests S3-specific functionality including:
 * - Constructor options and ID generation
 * - Icon detection from endpoint
 * - Display name derivation
 * - getMountConfig() output
 * - getInfo() output
 *
 * Based on the Workspace Filesystem & Sandbox Test Plan.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { S3Filesystem } from './index';

// Mock the AWS SDK
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(function () {
    return { send: vi.fn() };
  }),
  GetObjectCommand: vi.fn(),
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  CopyObjectCommand: vi.fn(),
  ListObjectsV2Command: vi.fn(),
  DeleteObjectsCommand: vi.fn(),
  HeadObjectCommand: vi.fn(),
  HeadBucketCommand: vi.fn(),
}));

describe('S3Filesystem', () => {
  describe('Constructor & Options', () => {
    it('generates unique id if not provided', () => {
      const fs1 = new S3Filesystem({ bucket: 'test', region: 'us-east-1' });
      const fs2 = new S3Filesystem({ bucket: 'test', region: 'us-east-1' });

      expect(fs1.id).toMatch(/^s3-fs-/);
      expect(fs2.id).toMatch(/^s3-fs-/);
      expect(fs1.id).not.toBe(fs2.id);
    });

    it('uses provided id', () => {
      const fs = new S3Filesystem({ id: 'my-custom-id', bucket: 'test', region: 'us-east-1' });

      expect(fs.id).toBe('my-custom-id');
    });

    it('sets readOnly from options', () => {
      const fsReadOnly = new S3Filesystem({ bucket: 'test', region: 'us-east-1', readOnly: true });
      const fsWritable = new S3Filesystem({ bucket: 'test', region: 'us-east-1', readOnly: false });
      const fsDefault = new S3Filesystem({ bucket: 'test', region: 'us-east-1' });

      expect(fsReadOnly.readOnly).toBe(true);
      expect(fsWritable.readOnly).toBe(false);
      expect(fsDefault.readOnly).toBeUndefined();
    });

    it('has correct provider and name', () => {
      const fs = new S3Filesystem({ bucket: 'test', region: 'us-east-1' });

      expect(fs.provider).toBe('s3');
      expect(fs.name).toBe('S3Filesystem');
    });

    it('status starts as pending', () => {
      const fs = new S3Filesystem({ bucket: 'test', region: 'us-east-1' });

      expect(fs.status).toBe('pending');
    });
  });

  describe('Icon Detection', () => {
    it('detects aws-s3 icon for no endpoint', () => {
      const fs = new S3Filesystem({ bucket: 'test', region: 'us-east-1' });

      expect(fs.icon).toBe('aws-s3');
    });

    it('detects r2 icon for R2 endpoint', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'auto',
        endpoint: 'https://abc123.r2.cloudflarestorage.com',
      });

      expect(fs.icon).toBe('r2');
    });

    it('detects gcs icon for Google endpoint', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
        endpoint: 'https://storage.googleapis.com',
      });

      expect(fs.icon).toBe('gcs');
    });

    it('detects azure icon for Azure endpoint', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
        endpoint: 'https://myaccount.blob.core.windows.net',
      });

      expect(fs.icon).toBe('azure');
    });

    it('detects minio icon for MinIO endpoint', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
        endpoint: 'http://minio.local:9000',
      });

      expect(fs.icon).toBe('minio');
    });

    it('uses s3 icon for generic S3-compatible endpoint', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
        endpoint: 'http://localhost:9000',
      });

      expect(fs.icon).toBe('s3');
    });

    it('uses provided icon over detection', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
        endpoint: 'https://abc123.r2.cloudflarestorage.com',
        icon: 'minio',
      });

      expect(fs.icon).toBe('minio');
    });
  });

  describe('Display Name', () => {
    it('derives displayName from icon - aws-s3', () => {
      const fs = new S3Filesystem({ bucket: 'test', region: 'us-east-1' });

      expect(fs.displayName).toBe('AWS S3');
    });

    it('derives displayName from icon - r2', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'auto',
        endpoint: 'https://abc123.r2.cloudflarestorage.com',
      });

      expect(fs.displayName).toBe('Cloudflare R2');
    });

    it('derives displayName from icon - gcs', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
        endpoint: 'https://storage.googleapis.com',
      });

      expect(fs.displayName).toBe('Google Cloud Storage');
    });

    it('derives displayName from icon - minio', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
        endpoint: 'http://minio.local:9000',
      });

      expect(fs.displayName).toBe('MinIO');
    });

    it('uses provided displayName over derived', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
        displayName: 'My Custom Storage',
      });

      expect(fs.displayName).toBe('My Custom Storage');
    });
  });

  describe('getMountConfig()', () => {
    it('returns S3MountConfig with required fields', () => {
      const fs = new S3Filesystem({ bucket: 'my-bucket', region: 'us-west-2' });

      const config = fs.getMountConfig();

      expect(config.type).toBe('s3');
      expect(config.bucket).toBe('my-bucket');
      expect(config.region).toBe('us-west-2');
    });

    it('includes endpoint if set', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
        endpoint: 'http://localhost:9000',
      });

      const config = fs.getMountConfig();

      expect(config.endpoint).toBe('http://localhost:9000');
    });

    it('includes credentials if set', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      const config = fs.getMountConfig();

      expect(config.accessKeyId).toBe('AKIAIOSFODNN7EXAMPLE');
      expect(config.secretAccessKey).toBe('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
    });

    it('does not include credentials if not set', () => {
      const fs = new S3Filesystem({ bucket: 'test', region: 'us-east-1' });

      const config = fs.getMountConfig();

      expect(config.accessKeyId).toBeUndefined();
      expect(config.secretAccessKey).toBeUndefined();
    });

    it('includes readOnly: true if set', () => {
      const fs = new S3Filesystem({ bucket: 'test', region: 'us-east-1', readOnly: true });

      const config = fs.getMountConfig();

      expect(config.readOnly).toBe(true);
    });

    it('excludes readOnly if false/undefined', () => {
      const fs1 = new S3Filesystem({ bucket: 'test', region: 'us-east-1', readOnly: false });
      const fs2 = new S3Filesystem({ bucket: 'test', region: 'us-east-1' });

      const config1 = fs1.getMountConfig();
      const config2 = fs2.getMountConfig();

      expect(config1.readOnly).toBeUndefined();
      expect(config2.readOnly).toBeUndefined();
    });
  });

  describe('getInfo()', () => {
    it('returns FilesystemInfo with all fields', () => {
      const fs = new S3Filesystem({
        id: 'test-id',
        bucket: 'my-bucket',
        region: 'us-west-2',
      });

      const info = fs.getInfo();

      expect(info.id).toBe('test-id');
      expect(info.name).toBe('S3Filesystem');
      expect(info.provider).toBe('s3');
      expect(info.status).toBe('pending');
      expect(info.icon).toBe('aws-s3');
    });

    it('metadata includes bucket and region', () => {
      const fs = new S3Filesystem({ bucket: 'my-bucket', region: 'eu-west-1' });

      const info = fs.getInfo();

      expect(info.metadata?.bucket).toBe('my-bucket');
      expect(info.metadata?.region).toBe('eu-west-1');
    });

    it('metadata includes endpoint if set', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
        endpoint: 'http://minio:9000',
      });

      const info = fs.getInfo();

      expect(info.metadata?.endpoint).toBe('http://minio:9000');
    });

    it('metadata excludes endpoint if not set', () => {
      const fs = new S3Filesystem({ bucket: 'test', region: 'us-east-1' });

      const info = fs.getInfo();

      expect(info.metadata?.endpoint).toBeUndefined();
    });

    it('metadata includes prefix if set', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
        prefix: 'workspace/data',
      });

      const info = fs.getInfo();

      expect(info.metadata?.prefix).toBe('workspace/data/');
    });
  });

  describe('getInstructions()', () => {
    it('returns description with bucket name', () => {
      const fs = new S3Filesystem({ bucket: 'my-bucket', region: 'us-east-1' });

      const instructions = fs.getInstructions();

      expect(instructions).toContain('my-bucket');
    });

    it('indicates read-only when set', () => {
      const fs = new S3Filesystem({ bucket: 'test', region: 'us-east-1', readOnly: true });

      const instructions = fs.getInstructions();

      expect(instructions).toContain('Read-only');
    });

    it('indicates persistent when writable', () => {
      const fs = new S3Filesystem({ bucket: 'test', region: 'us-east-1' });

      const instructions = fs.getInstructions();

      expect(instructions).toContain('Persistent');
    });
  });

  describe('S3 Client Configuration', () => {
    it('forcePathStyle defaults to true for custom endpoints', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const MockS3Client = vi.mocked(S3Client);
      MockS3Client.mockClear();

      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
        endpoint: 'http://minio:9000',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
      });

      // Trigger client creation
      try {
        await fs.readFile('test.txt');
      } catch {
        // Expected to fail (mock), but client should be created
      }

      // Verify S3Client was constructed with forcePathStyle: true
      expect(MockS3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          forcePathStyle: true,
        }),
      );
    });

    it('creates client lazily on first operation', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const MockS3Client = vi.mocked(S3Client);

      // Clear any calls from previous tests
      MockS3Client.mockClear();

      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
        accessKeyId: 'test',
        secretAccessKey: 'test',
      });

      // Constructor should NOT create the S3 client
      expect(MockS3Client).not.toHaveBeenCalled();

      // Trigger an operation that uses the client
      try {
        await fs.readFile('test.txt');
      } catch {
        // Expected to fail (mock doesn't return data), but client should be created
      }

      // Now the client should have been created
      expect(MockS3Client).toHaveBeenCalled();
    });

    it('reuses client for subsequent operations', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
        accessKeyId: 'test',
        secretAccessKey: 'test',
      });

      const fsAny = fs as any;

      // Simulate first operation creating the client
      const fakeClient = { send: vi.fn() };
      fsAny._client = fakeClient;

      // Subsequent getClient() calls should return the cached instance
      const client1 = fsAny.getClient();
      const client2 = fsAny.getClient();

      expect(client1).toBe(fakeClient);
      expect(client2).toBe(fakeClient);
      expect(client1).toBe(client2);
    });

    it('uses anonymous credentials for public buckets', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const MockS3Client = vi.mocked(S3Client);
      MockS3Client.mockClear();

      // When no credentials provided, S3Filesystem should handle anonymous access
      const fs = new S3Filesystem({
        bucket: 'public-bucket',
        region: 'us-east-1',
        // No accessKeyId/secretAccessKey
      });

      const config = fs.getMountConfig();

      // Mount config should not have credentials
      expect(config.accessKeyId).toBeUndefined();
      expect(config.secretAccessKey).toBeUndefined();

      // Trigger client creation to verify S3Client construction
      try {
        await fs.readFile('test.txt');
      } catch {
        // Expected to fail (mock), but client should be created
      }

      // Verify S3Client was constructed with empty credentials and signer bypass
      expect(MockS3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          credentials: { accessKeyId: '', secretAccessKey: '' },
          signer: expect.objectContaining({ sign: expect.any(Function) }),
        }),
      );
    });
  });

  describe('Path Handling', () => {
    it('toKey adds prefix to paths', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
        prefix: 'workspace',
      });

      // The prefix should be normalized and added to paths
      const info = fs.getInfo();
      expect(info.metadata?.prefix).toBe('workspace/');
    });

    it('toKey adds prefix to actual key construction', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
        prefix: 'workspace',
      });

      // Access the private toKey method to verify prefix is applied
      const key = (fs as any).toKey('/myfile.txt');
      expect(key).toBe('workspace/myfile.txt');
    });

    it('toKey removes leading slashes from paths', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
        prefix: '/foo/bar/',
      });

      // Prefix should be normalized to remove leading slashes
      const info = fs.getInfo();
      expect(info.metadata?.prefix).toBe('foo/bar/');
    });

    it('toKey strips leading slashes from paths', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
      });

      // Access the private toKey method to verify leading slash removal
      const key = (fs as any).toKey('/leading-slash.txt');
      expect(key).toBe('leading-slash.txt');

      // Multiple leading slashes
      const key2 = (fs as any).toKey('///multi-slash.txt');
      expect(key2).toBe('multi-slash.txt');
    });
  });

  describe('Prefix Handling', () => {
    it('normalizes prefix - removes leading slashes', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
        prefix: '/foo/bar',
      });

      const info = fs.getInfo();
      // Prefix should be normalized to "foo/bar/"
      expect(info.metadata?.prefix).toBe('foo/bar/');
    });

    it('normalizes prefix - removes trailing slashes', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
        prefix: 'foo/bar/',
      });

      const info = fs.getInfo();
      // Prefix should be normalized to "foo/bar/"
      expect(info.metadata?.prefix).toBe('foo/bar/');
    });

    it('normalizes prefix - handles both', () => {
      const fs = new S3Filesystem({
        bucket: 'test',
        region: 'us-east-1',
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
 * These verify the correct AWS SDK commands are called with the right parameters,
 * error mapping (NoSuchKey → FileNotFoundError), prefix handling, MIME types, and pagination.
 *
 * Integration tests (real S3) are in index.integration.test.ts.
 */
describe('S3Filesystem SDK Operations', () => {
  let fs: S3Filesystem;
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fs = new S3Filesystem({
      bucket: 'test-bucket',
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    // Set up mock client directly (avoids S3Client constructor issues with vi.mock)
    mockSend = vi.fn();
    (fs as any)._client = { send: mockSend };
    (fs as any).status = 'ready';
  });

  describe('readFile()', () => {
    it('returns Buffer by default', async () => {
      mockSend.mockResolvedValueOnce({
        Body: { transformToByteArray: () => Promise.resolve(new Uint8Array([104, 101, 108, 108, 111])) },
      });

      const result = await fs.readFile('/test.txt');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe('hello');
    });

    it('returns string when encoding specified', async () => {
      mockSend.mockResolvedValueOnce({
        Body: { transformToByteArray: () => Promise.resolve(new Uint8Array([104, 105])) },
      });

      const result = await fs.readFile('/test.txt', { encoding: 'utf-8' });

      expect(typeof result).toBe('string');
      expect(result).toBe('hi');
    });

    it('throws FileNotFoundError on NoSuchKey', async () => {
      const error = new Error('NoSuchKey');
      (error as any).name = 'NoSuchKey';
      mockSend.mockRejectedValueOnce(error);

      await expect(fs.readFile('/missing.txt')).rejects.toThrow(/missing\.txt/);
    });

    it('throws FileNotFoundError when Body is empty', async () => {
      mockSend.mockResolvedValueOnce({ Body: null });

      await expect(fs.readFile('/empty.txt')).rejects.toThrow(/empty\.txt/);
    });

    it('applies prefix to key', async () => {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const prefixFs = new S3Filesystem({
        bucket: 'test-bucket',
        region: 'us-east-1',
        accessKeyId: 'k',
        secretAccessKey: 's',
        prefix: 'my-prefix',
      });
      const prefixSend = vi.fn();
      (prefixFs as any)._client = { send: prefixSend };
      (prefixFs as any).status = 'ready';
      prefixSend.mockResolvedValueOnce({
        Body: { transformToByteArray: () => Promise.resolve(new Uint8Array([1])) },
      });

      await prefixFs.readFile('/file.txt');

      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'my-prefix/file.txt',
      });
    });

    it('re-throws non-NoSuchKey errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('AccessDenied'));

      await expect(fs.readFile('/test.txt')).rejects.toThrow('AccessDenied');
    });
  });

  describe('writeFile()', () => {
    it('sends PutObjectCommand with string content', async () => {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      mockSend.mockResolvedValueOnce({});

      await fs.writeFile('/test.txt', 'hello world');

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: 'test.txt',
          Body: Buffer.from('hello world', 'utf-8'),
          ContentType: 'text/plain',
        }),
      );
    });

    it('sends PutObjectCommand with Buffer content', async () => {
      mockSend.mockResolvedValueOnce({});

      const buf = Buffer.from([1, 2, 3]);
      await fs.writeFile('/data.bin', buf);

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('detects MIME type from extension', async () => {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');

      mockSend.mockResolvedValueOnce({});
      await fs.writeFile('/page.html', '<html>');
      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({ ContentType: 'text/html' }));

      vi.mocked(PutObjectCommand).mockClear();
      mockSend.mockResolvedValueOnce({});
      await fs.writeFile('/data.json', '{}');
      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({ ContentType: 'application/json' }));

      vi.mocked(PutObjectCommand).mockClear();
      mockSend.mockResolvedValueOnce({});
      await fs.writeFile('/unknown.xyz', 'data');
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({ ContentType: 'application/octet-stream' }),
      );
    });

    it('applies prefix to key', async () => {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const prefixFs = new S3Filesystem({
        bucket: 'b',
        region: 'us-east-1',
        accessKeyId: 'k',
        secretAccessKey: 's',
        prefix: 'pfx',
      });
      const pfxSend = vi.fn().mockResolvedValueOnce({});
      (prefixFs as any)._client = { send: pfxSend };
      (prefixFs as any).status = 'ready';

      await prefixFs.writeFile('/file.txt', 'data');

      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({ Key: 'pfx/file.txt' }));
    });
  });

  describe('appendFile()', () => {
    it('reads existing content then writes concatenated result', async () => {
      // First send: GetObjectCommand (read existing)
      mockSend.mockResolvedValueOnce({
        Body: { transformToByteArray: () => Promise.resolve(Buffer.from('hello ')) },
      });
      // Second send: PutObjectCommand (write result)
      mockSend.mockResolvedValueOnce({});

      await fs.appendFile('/test.txt', 'world');

      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('creates file if it does not exist', async () => {
      // First send: GetObjectCommand fails (file doesn't exist)
      const error = new Error('NoSuchKey');
      (error as any).name = 'NoSuchKey';
      mockSend.mockRejectedValueOnce(error);
      // Second send: PutObjectCommand (write new content)
      mockSend.mockResolvedValueOnce({});

      await fs.appendFile('/new.txt', 'content');

      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteFile()', () => {
    it('sends DeleteObjectCommand for files', async () => {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

      // First send: ListObjectsV2 for isDirectory check → not a directory
      mockSend.mockResolvedValueOnce({ Contents: [] });
      // Second send: DeleteObjectCommand
      mockSend.mockResolvedValueOnce({});

      await fs.deleteFile('/test.txt');

      expect(DeleteObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: 'test.txt',
        }),
      );
    });

    it('delegates to rmdir for directories', async () => {
      // isDirectory check → has contents (is directory)
      mockSend.mockResolvedValueOnce({ Contents: [{ Key: 'dir/file.txt' }] });
      // rmdir recursive: ListObjectsV2
      mockSend.mockResolvedValueOnce({ Contents: [{ Key: 'dir/file.txt' }] });
      // rmdir recursive: DeleteObjectsCommand
      mockSend.mockResolvedValueOnce({});

      await fs.deleteFile('/dir');

      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it('swallows errors with force option', async () => {
      // isDirectory check → not a directory
      mockSend.mockResolvedValueOnce({ Contents: [] });
      // DeleteObjectCommand fails
      mockSend.mockRejectedValueOnce(new Error('delete failed'));

      // Should not throw with force: true
      await expect(fs.deleteFile('/test.txt', { force: true })).resolves.not.toThrow();
    });

    it('throws on error without force option', async () => {
      // isDirectory check → not a directory
      mockSend.mockResolvedValueOnce({ Contents: [] });
      // DeleteObjectCommand fails with NoSuchKey (simulating AWS SDK error)
      const err = new Error('The specified key does not exist.');
      err.name = 'NoSuchKey';
      mockSend.mockRejectedValueOnce(err);

      await expect(fs.deleteFile('/test.txt')).rejects.toThrow(/test\.txt/);
    });
  });

  describe('copyFile()', () => {
    it('sends CopyObjectCommand with correct CopySource', async () => {
      const { CopyObjectCommand } = await import('@aws-sdk/client-s3');
      mockSend.mockResolvedValueOnce({});

      await fs.copyFile('/src.txt', '/dest.txt');

      expect(CopyObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          CopySource: 'test-bucket/src.txt',
          Key: 'dest.txt',
        }),
      );
    });

    it('throws FileNotFoundError when source missing', async () => {
      const err = new Error('The specified key does not exist.');
      err.name = 'NoSuchKey';
      mockSend.mockRejectedValueOnce(err);

      await expect(fs.copyFile('/missing.txt', '/dest.txt')).rejects.toThrow(/missing\.txt/);
    });
  });

  describe('moveFile()', () => {
    it('copies then deletes source', async () => {
      // CopyObjectCommand
      mockSend.mockResolvedValueOnce({});
      // isDirectory check for deleteFile
      mockSend.mockResolvedValueOnce({ Contents: [] });
      // DeleteObjectCommand (with force: true, so no throw on error)
      mockSend.mockResolvedValueOnce({});

      await fs.moveFile('/src.txt', '/dest.txt');

      expect(mockSend).toHaveBeenCalledTimes(3);
    });
  });

  describe('mkdir()', () => {
    it('is a no-op (S3 has no real directories)', async () => {
      await fs.mkdir('/new-dir');

      // No SDK calls should be made
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('rmdir()', () => {
    it('throws if non-recursive and directory is not empty', async () => {
      // readdir: ListObjectsV2 returns files
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'dir/file.txt', Size: 100 }],
        CommonPrefixes: [],
      });

      await expect(fs.rmdir('/dir')).rejects.toThrow('Directory not empty');
    });

    it('recursive deletes all objects with prefix', async () => {
      const { DeleteObjectsCommand } = await import('@aws-sdk/client-s3');

      // ListObjectsV2 returns objects
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'dir/a.txt' }, { Key: 'dir/b.txt' }],
      });
      // DeleteObjectsCommand
      mockSend.mockResolvedValueOnce({});

      await fs.rmdir('/dir', { recursive: true });

      expect(DeleteObjectsCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Delete: {
            Objects: [{ Key: 'dir/a.txt' }, { Key: 'dir/b.txt' }],
          },
        }),
      );
    });

    it('handles pagination during recursive delete', async () => {
      // First page
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'dir/a.txt' }],
        NextContinuationToken: 'token1',
      });
      mockSend.mockResolvedValueOnce({}); // DeleteObjectsCommand
      // Second page
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'dir/b.txt' }],
      });
      mockSend.mockResolvedValueOnce({}); // DeleteObjectsCommand

      await fs.rmdir('/dir', { recursive: true });

      // 4 calls: list + delete + list + delete
      expect(mockSend).toHaveBeenCalledTimes(4);
    });
  });

  describe('readdir()', () => {
    it('returns files from Contents', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'file1.txt', Size: 100 },
          { Key: 'file2.js', Size: 200 },
        ],
        CommonPrefixes: [],
      });

      const entries = await fs.readdir('/');

      expect(entries).toEqual([
        { name: 'file1.txt', type: 'file', size: 100 },
        { name: 'file2.js', type: 'file', size: 200 },
      ]);
    });

    it('returns directories from CommonPrefixes', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [],
        CommonPrefixes: [{ Prefix: 'subdir/' }],
      });

      const entries = await fs.readdir('/');

      expect(entries).toEqual([{ name: 'subdir', type: 'directory' }]);
    });

    it('handles pagination with ContinuationToken', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'a.txt', Size: 1 }],
        NextContinuationToken: 'token1',
      });
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'b.txt', Size: 2 }],
      });

      const entries = await fs.readdir('/');

      expect(entries).toHaveLength(2);
      expect(entries[0]!.name).toBe('a.txt');
      expect(entries[1]!.name).toBe('b.txt');
    });

    it('filters by extension', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'file.txt', Size: 1 },
          { Key: 'file.js', Size: 2 },
          { Key: 'file.ts', Size: 3 },
        ],
      });

      const entries = await fs.readdir('/', { extension: '.ts' });

      expect(entries).toHaveLength(1);
      expect(entries[0]!.name).toBe('file.ts');
    });

    it('recognizes directory markers (trailing slash)', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'mydir/', Size: 0 },
          { Key: 'file.txt', Size: 100 },
        ],
      });

      const entries = await fs.readdir('/');

      expect(entries).toContainEqual({ name: 'mydir', type: 'directory' });
      expect(entries).toContainEqual({ name: 'file.txt', type: 'file', size: 100 });
    });

    it('skips empty relative paths and searchPrefix itself', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'dir/', Size: 0 }, // The searchPrefix itself
          { Key: 'dir/real-file.txt', Size: 50 },
        ],
      });

      const entries = await fs.readdir('/dir');

      // Should only have the real file, not the directory marker that equals searchPrefix
      expect(entries).toEqual([{ name: 'real-file.txt', type: 'file', size: 50 }]);
    });
  });

  describe('root path handling', () => {
    it('exists("/") returns true without API calls', async () => {
      mockSend.mockClear();
      const result = await fs.exists('/');
      expect(result).toBe(true);
      expect(mockSend).not.toHaveBeenCalled();
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
    it('returns true when file exists (HeadObject succeeds)', async () => {
      mockSend.mockResolvedValueOnce({}); // HeadObjectCommand succeeds

      const result = await fs.exists('/test.txt');

      expect(result).toBe(true);
    });

    it('returns true when directory exists (ListObjects has contents)', async () => {
      // HeadObject fails (not a file)
      const err = new Error('NotFound');
      err.name = 'NotFound';
      mockSend.mockRejectedValueOnce(err);
      // ListObjectsV2 finds contents (is a directory)
      mockSend.mockResolvedValueOnce({ Contents: [{ Key: 'dir/file.txt' }] });

      const result = await fs.exists('/dir');

      expect(result).toBe(true);
    });

    it('returns false when nothing exists', async () => {
      // HeadObject fails
      const err = new Error('NotFound');
      err.name = 'NotFound';
      mockSend.mockRejectedValueOnce(err);
      // ListObjectsV2 finds nothing
      mockSend.mockResolvedValueOnce({ Contents: [] });

      const result = await fs.exists('/missing');

      expect(result).toBe(false);
    });
  });

  describe('stat()', () => {
    it('returns file stat from HeadObject', async () => {
      const lastMod = new Date('2024-01-15T10:30:00Z');
      mockSend.mockResolvedValueOnce({
        ContentLength: 1024,
        LastModified: lastMod,
      });

      const stat = await fs.stat('/docs/readme.txt');

      expect(stat).toEqual({
        name: 'readme.txt',
        path: '/docs/readme.txt',
        type: 'file',
        size: 1024,
        createdAt: lastMod,
        modifiedAt: lastMod,
      });
    });

    it('returns directory stat when file not found but prefix exists', async () => {
      // HeadObject fails
      const err = new Error('NotFound');
      err.name = 'NotFound';
      mockSend.mockRejectedValueOnce(err);
      // isDirectory: ListObjectsV2 finds contents
      mockSend.mockResolvedValueOnce({ Contents: [{ Key: 'mydir/file.txt' }] });

      const stat = await fs.stat('/mydir');

      expect(stat.type).toBe('directory');
      expect(stat.name).toBe('mydir');
      expect(stat.size).toBe(0);
    });

    it('throws FileNotFoundError when nothing exists', async () => {
      // HeadObject fails
      const err = new Error('NotFound');
      err.name = 'NotFound';
      mockSend.mockRejectedValueOnce(err);
      // isDirectory: ListObjectsV2 finds nothing
      mockSend.mockResolvedValueOnce({ Contents: [] });

      await expect(fs.stat('/missing')).rejects.toThrow(/missing/);
    });
  });
});
