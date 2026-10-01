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
    required: ['authors', 'layout'],
    properties: {
      privateKey: { type: 'string', description: 'Mesa private key. Falls back to MESA_PRIVATE_KEY when omitted.' },
      authors: {
        type: 'array',
        description: 'Commit authors attributed to writes',
        minItems: 1,
        items: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', description: 'Author name' },
            email: { type: 'string', description: 'Author email' },
          },
        },
      },
      layout: {
        type: 'object',
        minProperties: 1,
        description:
          'Mesa mount layout mapping absolute paths to repo declarations, e.g. { "/docs": { "kind": "repo", "name": "docs", "mode": "rw" } }',
      },
      cache: {
        type: 'object',
        description: 'Mesa filesystem cache configuration',
        properties: {
          diskCache: {
            type: 'object',
            required: ['path'],
            properties: {
              path: { type: 'string', description: 'Disk cache path' },
              maxSizeBytes: { type: 'number', description: 'Maximum disk cache size in bytes' },
            },
          },
        },
      },
      ttl: { type: 'number', description: 'Mesa mount token lifetime in seconds' },
      readOnly: { type: 'boolean', description: 'Mount every layout repo as read-only', default: false },
    },
  },
  createFilesystem: config => new MesaFilesystem(config),
};
