/**
 * islo sandbox provider descriptor for MastraEditor.
 *
 * @example
 * ```typescript
 * import { isloSandboxProvider } from '@mastra/islo';
 *
 * const editor = new MastraEditor({
 *   sandboxes: [isloSandboxProvider],
 * });
 * ```
 */
import type { SandboxProvider } from '@mastra/core/editor';

import { IsloSandbox } from './sandbox';

/**
 * Serializable subset of `IsloSandboxOptions` for editor storage. Non-
 * serializable options (callbacks) are excluded.
 */
interface IsloProviderConfig {
  sandboxName?: string;
  image?: string;
  workdir?: string;
  gatewayProfile?: string;
  env?: Record<string, string>;
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

export const isloSandboxProvider: SandboxProvider<IsloProviderConfig> = {
  id: 'islo',
  name: 'islo Sandbox',
  description: 'Cloud sandbox powered by islo.dev',
  configSchema: {
    type: 'object',
    properties: {
      sandboxName: { type: 'string', description: 'Sandbox name (path segment)' },
      image: { type: 'string', description: 'Container image (e.g. docker.io/library/ubuntu:24.04)' },
      workdir: { type: 'string', description: 'Working directory relative to /workspace' },
      gatewayProfile: { type: 'string', description: 'Gateway profile name or id' },
      env: {
        type: 'object',
        description: 'Environment variables for sandbox creation',
        additionalProperties: { type: 'string' },
      },
      apiKey: { type: 'string', description: 'islo API key (falls back to ISLO_API_KEY)' },
      baseUrl: { type: 'string', description: 'islo API base URL (falls back to ISLO_BASE_URL)' },
      timeout: { type: 'number', description: 'Default per-command timeout in milliseconds', default: 300000 },
      metadata: {
        type: 'object',
        description: 'Custom metadata',
        additionalProperties: true,
      },
    },
  },
  createSandbox: (config) => new IsloSandbox(config),
};
