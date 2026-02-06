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

import { describe, it, expect, vi } from 'vitest';

import { S3Filesystem } from './index';

// Mock the AWS SDK
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  GetObjectCommand: vi.fn(),
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  CopyObjectCommand: vi.fn(),
  ListObjectsV2Command: vi.fn(),
  DeleteObjectsCommand: vi.fn(),
  HeadObjectCommand: vi.fn(),
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

      // Manually set _client to simulate a created client
      const fakeClient = { send: vi.fn() };
      fsAny._client = fakeClient;

      // getClient() should return the cached _client, not create a new one
      const result = fsAny.getClient();

      expect(result).toBe(fakeClient);
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
 * Integration tests are in index.integration.test.ts
 * They are separated to avoid conflicts with the mocked AWS SDK above.
 */
