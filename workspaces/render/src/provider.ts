import type { SandboxProvider } from '@mastra/core/editor';
import { RenderSandbox } from './sandbox.js';

interface ProviderConfig {
  ownerId?: `tea-${string}`;
  sandboxId?: string;
  workingDirectory?: string;
}

/** Credentials come from the host, never from editor-stored provider configuration. */
export const renderSandboxProvider: SandboxProvider<ProviderConfig> = {
  id: 'render',
  name: 'Render Sandbox',
  description: 'Run agent commands in Render Sandboxes',
  configSchema: {
    type: 'object',
    properties: {
      ownerId: { type: 'string', description: 'Render workspace ID' },
      sandboxId: { type: 'string', description: 'Optional caller-owned sandbox ID' },
      workingDirectory: {
        type: 'string',
        description: 'Existing absolute directory for commands',
        default: '/',
      },
    },
    additionalProperties: false,
  },
  createSandbox: config => new RenderSandbox(config),
};
