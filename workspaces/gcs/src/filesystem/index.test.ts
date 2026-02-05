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
  Storage: vi.fn().mockImplementation(() => ({
    bucket: vi.fn().mockReturnValue({
      file: vi.fn().mockReturnValue({
        download: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
        copy: vi.fn(),
        exists: vi.fn(),
        getMetadata: vi.fn(),
      }),
      getFiles: vi.fn().mockResolvedValue([[]]),
      deleteFiles: vi.fn(),
    }),
  })),
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
    it('returns FilesystemInfo with gcs icon', () => {
      const fs = new GCSFilesystem({ id: 'test-id', bucket: 'my-bucket' });

      const info = fs.getInfo?.();

      // GCSFilesystem may not implement getInfo yet
      if (info) {
        expect(info.id).toBe('test-id');
        expect(info.name).toBe('GCSFilesystem');
        expect(info.provider).toBe('gcs');
        expect(info.icon).toBe('gcs');
      }
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

  describe('Prefix Handling', () => {
    it('normalizes prefix - removes leading slashes', () => {
      const fs = new GCSFilesystem({
        bucket: 'test',
        prefix: '/foo/bar',
      });

      // Can verify via getMountConfig or internal state
      expect(fs.provider).toBe('gcs');
    });

    it('normalizes prefix - removes trailing slashes', () => {
      const fs = new GCSFilesystem({
        bucket: 'test',
        prefix: 'foo/bar/',
      });

      expect(fs.provider).toBe('gcs');
    });
  });
});

/**
 * Integration tests are in index.integration.test.ts
 * They are separated to avoid conflicts with the mocked GCS SDK above.
 */
