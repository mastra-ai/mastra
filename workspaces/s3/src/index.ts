/**
 * @mastra/s3 - S3-Compatible Filesystem Provider
 *
 * A filesystem implementation backed by Amazon S3 or S3-compatible storage.
 * Works with AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces, etc.
 */

export { S3Filesystem, type S3FilesystemOptions } from './s3-filesystem';

// Re-export S3MountConfig from core for convenience
export type { S3MountConfig } from '@mastra/core/workspace';
