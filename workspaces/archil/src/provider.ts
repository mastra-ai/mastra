/**
 * Archil filesystem provider descriptor for MastraEditor.
 */
import type { FilesystemProvider } from '@mastra/core/editor';
import { ArchilFilesystem } from './filesystem';
import type { ArchilFilesystemOptions } from './filesystem';

export const archilFilesystemProvider: FilesystemProvider<ArchilFilesystemOptions> = {
  id: 'archil',
  name: 'Archil',
  description: 'Elastic, serverless filesystem for AI agents (Archil)',
  configSchema: {
    type: 'object',
    oneOf: [{ required: ['diskId'] }, { required: ['createDiskOptions'] }],
    properties: {
      diskId: { type: 'string', description: 'Existing Archil disk ID (e.g. "dsk-0123456789abcdef")' },
      createDiskOptions: { type: 'object', description: 'Options used to create a new Archil disk on init' },
      apiKey: { type: 'string', description: 'Archil API key (falls back to ARCHIL_API_KEY env var)' },
      region: { type: 'string', description: 'Archil region (e.g. "aws-us-east-1")' },
      readOnly: { type: 'boolean', description: 'Mount as read-only', default: false },
      baseUrl: { type: 'string', description: 'Custom control-plane URL (for testing)' },
      s3BaseUrl: { type: 'string', description: 'Custom S3 API URL' },
    },
  },
  createFilesystem: config => new ArchilFilesystem(config),
};
