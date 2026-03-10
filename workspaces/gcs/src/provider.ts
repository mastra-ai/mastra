/**
 * GCS filesystem provider descriptor for MastraEditor.
 *
 * @example
 * ```typescript
 * import { gcsFilesystemProvider } from '@mastra/gcs';
 *
 * const editor = new MastraEditor({
 *   filesystems: [gcsFilesystemProvider],
 * });
 * ```
 */
import type { FilesystemProvider } from '@mastra/core/editor';
import { GCSFilesystem } from './filesystem';
import type { GCSFilesystemOptions } from './filesystem';

export const gcsFilesystemProvider: FilesystemProvider<GCSFilesystemOptions> = {
  id: 'gcs',
  name: 'Google Cloud Storage',
  description: 'Google Cloud Storage bucket',
  configSchema: {
    type: 'object',
    required: ['bucket'],
    properties: {
      bucket: { type: 'string', description: 'GCS bucket name' },
      projectId: { type: 'string', description: 'GCS project ID' },
      credentials: {
        description: 'Service account key JSON object or path to key file',
        oneOf: [{ type: 'object' }, { type: 'string' }],
      },
      prefix: { type: 'string', description: 'Key prefix (acts like a subdirectory)' },
      readOnly: { type: 'boolean', description: 'Mount as read-only', default: false },
      endpoint: { type: 'string', description: 'Custom API endpoint URL (for local emulators)' },
    },
  },
  createFilesystem: config => new GCSFilesystem(config),
};
