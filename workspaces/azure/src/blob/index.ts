/**
 * @mastra/azure/blob - Azure Blob Storage Filesystem & Blob Store Provider
 *
 * A filesystem and content-addressable blob store backed by Azure Blob Storage.
 */

export { AzureBlobFilesystem, type AzureBlobFilesystemOptions, type AzureBlobMountConfig } from './filesystem';
export { AzureBlobStore, type AzureBlobStoreOptions } from './blob-store';
export { azureBlobFilesystemProvider, azureBlobStoreProvider } from './provider';
