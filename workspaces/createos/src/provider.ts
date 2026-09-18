import type { SandboxProvider } from '@mastra/core/editor';

import { CreateOSSandbox } from './sandbox';

interface CreateOSProviderConfig {
  shape?: string;
  rootfs?: string;
  computerUse?: boolean;
  diskMib?: number;
  egress?: string[];
  ingress?: boolean;
  region?: string;
  autoPauseAfterSeconds?: number;
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  env?: Record<string, string>;
  workingDirectory?: string;
}

export const createosSandboxProvider: SandboxProvider<CreateOSProviderConfig> = {
  id: 'createos',
  name: 'CreateOS Sandbox',
  description: 'Cloud sandbox powered by CreateOS',
  configSchema: {
    type: 'object',
    properties: {
      shape: { type: 'string', description: 'CreateOS shape identifier', default: 's-2vcpu-2gb' },
      rootfs: { type: 'string', description: 'Root filesystem or template identifier' },
      computerUse: {
        type: 'boolean',
        description: 'Enable screenshot, mouse, keyboard, and noVNC desktop controls',
        default: false,
      },
      diskMib: { type: 'number', description: 'Overlay disk size in MiB' },
      egress: { type: 'array', description: 'Egress allowlist', items: { type: 'string' } },
      ingress: { type: 'boolean', description: 'Enable public HTTP ingress', default: false },
      region: { type: 'string', description: 'CreateOS region' },
      autoPauseAfterSeconds: { type: 'number', description: 'Idle auto-pause timeout in seconds' },
      apiKey: { type: 'string', description: 'CreateOS API key' },
      baseUrl: { type: 'string', description: 'CreateOS control-plane URL' },
      timeout: { type: 'number', description: 'Default timeout in milliseconds', default: 300000 },
      env: { type: 'object', description: 'Runtime environment variables', additionalProperties: { type: 'string' } },
      workingDirectory: { type: 'string', description: 'Default working directory' },
    },
  },
  createSandbox: config => new CreateOSSandbox(config),
};
