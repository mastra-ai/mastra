import type { FilesystemProvider } from '@mastra/core/editor';
import { AzureBlobFilesystem } from './filesystem';
import type { AzureBlobFilesystemOptions } from './filesystem';

export const azureBlobFilesystemProvider: FilesystemProvider<AzureBlobFilesystemOptions> = {
  id: 'azure-blob',
  name: 'Azure Blob Storage',
  description: 'Azure Blob Storage container',
  configSchema: {
    type: 'object',
    required: ['container'],
    properties: {
      container: { type: 'string', description: 'Azure Blob container name' },
      accountName: { type: 'string', description: 'Storage account name' },
      accountKey: { type: 'string', description: 'Storage account key' },
      sasToken: { type: 'string', description: 'Shared Access Signature token' },
      connectionString: { type: 'string', description: 'Full connection string (overrides other auth options)' },
      useDefaultCredential: {
        type: 'boolean',
        description: 'Use DefaultAzureCredential (requires @azure/identity)',
        default: false,
      },
      prefix: { type: 'string', description: 'Key prefix (acts like a subdirectory)' },
      readOnly: { type: 'boolean', description: 'Mount as read-only', default: false },
      endpoint: { type: 'string', description: 'Custom endpoint URL (for Azurite emulator)' },
    },
  },
  createFilesystem: config => new AzureBlobFilesystem(config),
};
