import type { SandboxProvider } from '@mastra/core/editor';

import { MainbrellaSandbox } from './sandbox';
import type { MainbrellaSandboxOptions } from './sandbox';

export type MainbrellaProviderConfig = Pick<
  MainbrellaSandboxOptions,
  | 'id'
  | 'apiKey'
  | 'apiUrl'
  | 'catalogId'
  | 'imageId'
  | 'workspaceId'
  | 'size'
  | 'internet'
  | 'container'
  | 'creationKey'
  | 'startupTimeout'
  | 'timeout'
  | 'env'
  | 'workingDirectory'
>;

export const mainbrellaSandboxProvider: SandboxProvider<MainbrellaProviderConfig> = {
  id: 'mainbrella',
  name: 'Mainbrella Sandbox',
  description: 'Cloud Linux containers powered by Mainbrella',
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      id: { type: 'string', description: 'Logical Mastra sandbox ID' },
      apiKey: { type: 'string', description: 'Server-side API key; defaults to MAINBRELLA_API_KEY' },
      apiUrl: {
        type: 'string',
        description: 'API origin; defaults to MAINBRELLA_API_URL or https://api.mainbrella.com',
      },
      catalogId: {
        type: 'string',
        description: 'Deployed runtime catalog ID; defaults to node when no image or saved workspace is selected',
      },
      imageId: { type: 'string', description: 'Account-owned ready custom image ID' },
      workspaceId: { type: 'string', description: 'Saved workspace to restore' },
      size: { type: 'string', enum: ['lite', 'small', 'medium', 'large', 'xl'] },
      internet: { type: 'boolean', description: 'Outbound internet policy; disabling requires deployment support' },
      container: {
        type: 'object',
        description: 'Reconnect to an exact running generation',
        required: ['id', 'createdAt'],
        additionalProperties: false,
        properties: { id: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' } },
      },
      creationKey: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,128}$', description: 'Stable creation recovery key' },
      startupTimeout: { type: 'integer', minimum: 1, default: 120_000 },
      timeout: { type: 'integer', minimum: 1, maximum: 900_000, default: 30_000 },
      env: { type: 'object', additionalProperties: { type: 'string' }, description: 'Command environment overlay' },
      workingDirectory: { type: 'string', default: '/workspace' },
    },
    allOf: [
      { not: { required: ['catalogId', 'imageId'] } },
      { not: { required: ['catalogId', 'workspaceId'] } },
      { not: { required: ['imageId', 'workspaceId'] } },
    ],
  },
  createSandbox: config => new MainbrellaSandbox(config),
};
