/**
 * Railway sandbox provider descriptor for MastraEditor.
 *
 * @example
 * ```typescript
 * import { railwaySandboxProvider } from '@mastra/railway';
 *
 * const editor = new MastraEditor({
 *   sandboxes: { [railwaySandboxProvider.id]: railwaySandboxProvider },
 * });
 * ```
 */
import type { SandboxProvider } from '@mastra/core/editor';
import { RailwaySandbox } from './sandbox';

/**
 * Serializable subset of RailwaySandboxOptions for editor storage.
 */
interface RailwayProviderConfig {
  token?: string;
  environmentId?: string;
  sandboxId?: string;
  idleTimeoutMinutes?: number;
  networkIsolation?: 'ISOLATED' | 'PRIVATE';
  env?: Record<string, string>;
  timeout?: number;
}

export const railwaySandboxProvider: SandboxProvider<RailwayProviderConfig> = {
  id: 'railway',
  name: 'Railway Sandbox',
  description: 'Ephemeral, isolated Linux VM powered by Railway',
  configSchema: {
    type: 'object',
    properties: {
      token: { type: 'string', description: 'Railway API token (falls back to RAILWAY_API_TOKEN)' },
      environmentId: {
        type: 'string',
        description: 'Railway environment ID (falls back to RAILWAY_ENVIRONMENT_ID)',
      },
      sandboxId: { type: 'string', description: 'Reattach to an existing Railway sandbox by ID' },
      idleTimeoutMinutes: {
        type: 'number',
        description: 'Minutes a sandbox can sit idle before Railway destroys it',
      },
      networkIsolation: {
        type: 'string',
        description: 'Network isolation mode',
        enum: ['ISOLATED', 'PRIVATE'],
        default: 'ISOLATED',
      },
      env: {
        type: 'object',
        description: 'Environment variables',
        additionalProperties: { type: 'string' },
      },
      timeout: { type: 'number', description: 'Default command timeout in ms' },
    },
  },
  createSandbox: config => new RailwaySandbox(config),
};
