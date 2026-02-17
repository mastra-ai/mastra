/**
 * E2B sandbox provider descriptor for MastraEditor.
 *
 * @example
 * ```typescript
 * import { e2bSandboxProvider } from '@mastra/e2b';
 *
 * const editor = new MastraEditor({
 *   sandboxes: [e2bSandboxProvider],
 * });
 * ```
 */
import type { SandboxProvider } from '@mastra/core/editor';
import { E2BSandbox } from './sandbox';

/**
 * Serializable subset of E2BSandboxOptions for editor storage.
 * Non-serializable options (TemplateBuilder callbacks, runtime objects) are excluded.
 */
interface E2BProviderConfig {
  template?: string;
  timeout?: number;
  env?: Record<string, string>;
  metadata?: Record<string, unknown>;
  domain?: string;
  apiUrl?: string;
  apiKey?: string;
  accessToken?: string;
}

export const e2bSandboxProvider: SandboxProvider<E2BProviderConfig> = {
  id: 'e2b',
  name: 'E2B Sandbox',
  description: 'Cloud sandbox powered by E2B',
  configSchema: {
    type: 'object',
    properties: {
      template: { type: 'string', description: 'Sandbox template ID' },
      timeout: { type: 'number', description: 'Execution timeout in milliseconds', default: 300000 },
      env: {
        type: 'object',
        description: 'Environment variables',
        additionalProperties: { type: 'string' },
      },
      metadata: {
        type: 'object',
        description: 'Custom metadata',
        additionalProperties: true,
      },
      domain: { type: 'string', description: 'Domain for self-hosted E2B' },
      apiUrl: { type: 'string', description: 'API URL for self-hosted E2B' },
      apiKey: { type: 'string', description: 'E2B API key' },
      accessToken: { type: 'string', description: 'E2B access token' },
    },
  },
  createSandbox: config => new E2BSandbox(config),
};
