/**
 * Mesa filesystem provider descriptor for MastraEditor.
 */
import type { FilesystemProvider } from '@mastra/core/editor';

import { MesaFilesystem } from './filesystem';
import type { MesaFilesystemOptions } from './filesystem';

export const mesaFilesystemProvider: FilesystemProvider<MesaFilesystemOptions> = {
  id: 'mesa',
  name: 'Mesa',
  description: 'Versioned Mesa filesystem for workspace files',
  configSchema: {
    type: 'object',
    required: ['repos'],
    properties: {
      apiKey: { type: 'string', description: 'Mesa API key. Falls back to MESA_API_KEY when omitted.' },
      org: { type: 'string', description: 'Mesa org slug' },
      repos: {
        type: 'array',
        description: 'Mesa repos to mount',
        minItems: 1,
        items: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', description: 'Mesa repo name' },
            bookmark: { type: 'string', description: 'Bookmark to mount' },
            changeId: { type: 'string', description: 'Change ID to mount' },
            readOnly: { type: 'boolean', description: 'Mount this repo as read-only' },
          },
        },
      },
      cache: { type: 'object', description: 'Mesa filesystem cache configuration' },
      ttl: { type: 'number', description: 'Mesa mount token lifetime in seconds' },
      readOnly: { type: 'boolean', description: 'Mount all repos as read-only', default: false },
    },
  },
  createFilesystem: config => new MesaFilesystem(config),
};
