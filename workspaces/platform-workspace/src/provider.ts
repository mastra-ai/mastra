import type { FilesystemProvider, SandboxProvider } from '@mastra/core/editor';
import type { PlatformFilesystemOptions } from './filesystem.js';
import { PlatformFilesystem } from './filesystem.js';
import type { PlatformSandboxOptions } from './sandbox.js';
import { PlatformSandbox } from './sandbox.js';

export const platformSandboxProvider: SandboxProvider<PlatformSandboxOptions> = {
  id: 'platform',
  name: 'Mastra Platform Sandbox',
  description: 'Environment-scoped sandbox execution through Mastra Platform workspace proxy',
  configSchema: {
    type: 'object',
    properties: {
      accessToken: {
        type: 'string',
        description: 'Mastra Platform access token (falls back to MASTRA_PLATFORM_ACCESS_TOKEN)',
      },
      projectId: { type: 'string', description: 'Platform project ID (falls back to MASTRA_PROJECT_ID)' },
      environmentId: { type: 'string', description: 'Platform environment ID (falls back to MASTRA_ENVIRONMENT_ID)' },
      sandboxId: { type: 'string', description: 'Reattach to an existing Platform sandbox by ID' },
      idleTimeoutMinutes: { type: 'number', description: 'Minutes before the sandbox can be destroyed while idle' },
      networkIsolation: {
        type: 'string',
        description: 'Network isolation mode',
        enum: ['ISOLATED', 'PRIVATE'],
        default: 'ISOLATED',
      },
      env: { type: 'object', description: 'Environment variables', additionalProperties: { type: 'string' } },
      timeout: { type: 'number', description: 'Default command timeout in ms' },
    },
  },
  createSandbox: config => new PlatformSandbox(config),
};

export const platformFilesystemProvider: FilesystemProvider<PlatformFilesystemOptions> = {
  id: 'platform',
  name: 'Mastra Platform Filesystem',
  description: 'Bucket-backed filesystem access through Mastra Platform workspace proxy',
  configSchema: {
    type: 'object',
    properties: {
      accessToken: {
        type: 'string',
        description: 'Mastra Platform access token (falls back to MASTRA_PLATFORM_ACCESS_TOKEN)',
      },
      projectId: { type: 'string', description: 'Platform project ID (falls back to MASTRA_PROJECT_ID)' },
      bucketName: {
        type: 'string',
        description: 'Platform workspace bucket name (falls back to MASTRA_PLATFORM_BUCKET_NAME)',
      },
      readOnly: { type: 'boolean', description: 'Mount as read-only', default: false },
    },
  },
  createFilesystem: config => new PlatformFilesystem(config),
};
