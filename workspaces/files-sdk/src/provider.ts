/**
 * FilesSDK filesystem provider descriptor for MastraEditor.
 *
 * @example
 * ```typescript
 * import { filesSDKFilesystemProvider } from '@mastra/files-sdk';
 *
 * const editor = new MastraEditor({
 *   filesystems: [filesSDKFilesystemProvider],
 * });
 * ```
 */
import type { FilesystemProvider } from '@mastra/core/editor';
import { FilesSDKFilesystem } from './filesystem';
import type { FilesSDKFilesystemOptions } from './filesystem';

export const filesSDKFilesystemProvider: FilesystemProvider<FilesSDKFilesystemOptions> = {
  id: 'files-sdk',
  name: 'FilesSDK (Unified Storage)',
  description: 'Unified storage via FilesSDK — supports S3, R2, GCS, Azure, Vercel Blob, local filesystem, and more',
  configSchema: {
    type: 'object',
    required: ['files'],
    properties: {
      files: { type: 'object', description: 'Pre-configured FilesSDK Files instance' },
      id: { type: 'string', description: 'Unique filesystem ID' },
      displayName: { type: 'string', description: 'Human-friendly display name' },
      icon: { type: 'string', description: 'Icon identifier for UI' },
      description: { type: 'string', description: 'Description for UI' },
      readOnly: { type: 'boolean', description: 'Mount as read-only', default: false },
    },
  },
  createFilesystem: config => new FilesSDKFilesystem(config),
};
