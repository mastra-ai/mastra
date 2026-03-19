/**
 * @mastra/s3 - S3-Compatible Filesystem & Blob Storage Provider
 *
 * A filesystem implementation backed by Amazon S3 or S3-compatible storage.
 * Works with AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces, etc.
 */

export { S3Filesystem, type S3FilesystemOptions, type S3MountConfig } from './filesystem';
export { s3FilesystemProvider, s3BlobStoreProvider } from './provider';
export { S3BlobStore, type S3BlobStoreOptions } from './blob-store';
