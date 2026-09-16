import type { SandboxProvider } from '@mastra/core/editor';

import { FreestyleSandbox } from './sandbox';
import type { FreestyleCreateOptions } from './sandbox';

export interface FreestyleProviderConfig {
  id?: string;
  apiKey?: string;
  baseUrl?: string;
  workingDirectory?: string;
  commandTimeoutMs?: number;
  createOptions?: FreestyleCreateOptions;
}

export const freestyleSandboxProvider: SandboxProvider<FreestyleProviderConfig> = {
  id: 'freestyle',
  name: 'Freestyle Sandbox',
  description: 'Powerful, persistent, hardware-virtualized Linux VMs with full root access',
  configSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Stable VM slug used for reconnection' },
      apiKey: { type: 'string', description: 'Freestyle API key (falls back to FREESTYLE_API_KEY)' },
      baseUrl: { type: 'string', description: 'Freestyle API base URL' },
      workingDirectory: { type: 'string', description: 'Default command working directory' },
      commandTimeoutMs: {
        type: 'number',
        description: 'Default command timeout in milliseconds',
        default: 300000,
      },
      createOptions: {
        type: 'object',
        description: 'Options forwarded to freestyle.vms.create()',
        additionalProperties: true,
      },
    },
  },
  createSandbox: config => new FreestyleSandbox(config),
};
