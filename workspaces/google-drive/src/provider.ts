/**
 * Google Drive filesystem provider descriptor for MastraEditor.
 *
 * @example
 * ```typescript
 * import { googleDriveFilesystemProvider } from '@mastra/google-drive';
 *
 * const editor = new MastraEditor({
 *   filesystems: [googleDriveFilesystemProvider],
 * });
 * ```
 */
import type { FilesystemProvider } from '@mastra/core/editor';
import { GoogleDriveFilesystem } from './filesystem';
import type { GoogleDriveFilesystemOptions } from './filesystem';

export const googleDriveFilesystemProvider: FilesystemProvider<GoogleDriveFilesystemOptions> = {
  id: 'google-drive',
  name: 'Google Drive',
  description: 'Google Drive folder mounted as a filesystem',
  configSchema: {
    type: 'object',
    required: ['folderId'],
    properties: {
      folderId: { type: 'string', description: 'Google Drive folder ID to mount as the workspace root' },
      accessToken: {
        type: 'string',
        description: 'OAuth access token with the https://www.googleapis.com/auth/drive scope',
      },
      serviceAccount: {
        type: 'object',
        required: ['clientEmail', 'privateKey'],
        properties: {
          clientEmail: { type: 'string', description: 'Google service account email' },
          privateKey: { type: 'string', description: 'PEM-encoded private key' },
          privateKeyId: { type: 'string', description: 'Optional private key ID' },
          scopes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional OAuth scopes override',
          },
          subject: { type: 'string', description: 'Optional delegated user email' },
        },
        description: 'Service account credentials for server-to-server auth',
      },
      readOnly: { type: 'boolean', description: 'Mount as read-only', default: false },
    },
  },
  createFilesystem: config => new GoogleDriveFilesystem(config),
};
