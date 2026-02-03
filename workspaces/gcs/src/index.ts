/**
 * @mastra/gcs - Google Cloud Storage Filesystem Provider
 *
 * A filesystem implementation backed by Google Cloud Storage.
 */

export { GCSFilesystem, type GCSFilesystemOptions, type GCSMountConfig } from './gcs-filesystem';

// Re-export core types for convenience
export type { MountResult, FilesystemMountConfig } from '@mastra/core/workspace';
