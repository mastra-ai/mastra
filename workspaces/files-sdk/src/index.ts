/**
 * @mastra/files-sdk - Unified Storage Filesystem Provider
 *
 * A filesystem implementation backed by FilesSDK (https://files-sdk.dev).
 * Works with any FilesSDK adapter: S3, R2, GCS, Azure Blob, Vercel Blob,
 * local filesystem, and more.
 */

export { FilesSDKFilesystem, type FilesSDKFilesystemOptions } from './filesystem';
export { filesSDKFilesystemProvider } from './provider';
