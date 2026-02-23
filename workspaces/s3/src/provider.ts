/**
 * S3 filesystem provider descriptor for MastraEditor.
 *
 * @example
 * ```typescript
 * import { s3FilesystemProvider } from '@mastra/s3';
 *
 * const editor = new MastraEditor({
 *   filesystems: [s3FilesystemProvider],
 * });
 * ```
 */
import type { FilesystemProvider, BlobStoreProvider } from '@mastra/core/editor';
import { S3BlobStore } from './blob-store';
import type { S3BlobStoreOptions } from './blob-store';
import { S3Filesystem } from './filesystem';
import type { S3FilesystemOptions } from './filesystem';

export const s3FilesystemProvider: FilesystemProvider<S3FilesystemOptions> = {
  id: 's3',
  name: 'Amazon S3',
  description: 'S3 or S3-compatible storage (AWS, R2, MinIO, DO Spaces)',
  configSchema: {
    type: 'object',
    required: ['bucket', 'region'],
    properties: {
      bucket: { type: 'string', description: 'S3 bucket name' },
      region: { type: 'string', description: 'AWS region (use "auto" for R2)' },
      accessKeyId: { type: 'string', description: 'AWS access key ID' },
      secretAccessKey: { type: 'string', description: 'AWS secret access key' },
      endpoint: { type: 'string', description: 'Custom endpoint URL for S3-compatible storage' },
      forcePathStyle: { type: 'boolean', description: 'Force path-style URLs', default: false },
      prefix: { type: 'string', description: 'Key prefix (acts like a subdirectory)' },
      readOnly: { type: 'boolean', description: 'Mount as read-only', default: false },
    },
  },
  createFilesystem: config => new S3Filesystem(config),
};

/**
 * S3 blob store provider descriptor for MastraEditor.
 *
 * @example
 * ```typescript
 * import { s3BlobStoreProvider } from '@mastra/s3';
 *
 * const editor = new MastraEditor({
 *   blobStores: { s3: s3BlobStoreProvider },
 * });
 * ```
 */
export const s3BlobStoreProvider: BlobStoreProvider<S3BlobStoreOptions> = {
  id: 's3',
  name: 'Amazon S3 Blob Store',
  description: 'Content-addressable blob storage using S3 or S3-compatible storage (AWS, R2, MinIO, DO Spaces)',
  configSchema: {
    type: 'object',
    required: ['bucket', 'region', 'accessKeyId', 'secretAccessKey'],
    properties: {
      bucket: { type: 'string', description: 'S3 bucket name' },
      region: { type: 'string', description: 'AWS region (use "auto" for R2)' },
      accessKeyId: { type: 'string', description: 'AWS access key ID' },
      secretAccessKey: { type: 'string', description: 'AWS secret access key' },
      endpoint: { type: 'string', description: 'Custom endpoint URL for S3-compatible storage' },
      forcePathStyle: { type: 'boolean', description: 'Force path-style URLs', default: false },
      prefix: { type: 'string', description: 'Key prefix for blob objects (default: mastra_skill_blobs/)' },
    },
  },
  createBlobStore: config => new S3BlobStore(config),
};
