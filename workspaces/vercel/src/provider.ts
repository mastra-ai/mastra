/**
 * Vercel sandbox provider descriptor for MastraEditor.
 *
 * @example
 * ```typescript
 * import { vercelSandboxProvider } from '@mastra/vercel';
 *
 * const editor = new MastraEditor({
 *   sandboxes: [vercelSandboxProvider],
 * });
 * ```
 */
import type { SandboxProvider } from '@mastra/core/editor';
import { VercelSandbox } from './sandbox';

/**
 * Serializable subset of VercelSandboxOptions for editor storage.
 */
interface VercelProviderConfig {
  runtime?: 'node24' | 'node22' | 'python3.13';
  vcpus?: 1 | 2 | 4 | 8;
  timeout?: number;
  ports?: number[];
  env?: Record<string, string>;
}

export const vercelSandboxProvider: SandboxProvider<VercelProviderConfig> = {
  id: 'vercel',
  name: 'Vercel Sandbox',
  description: 'Ephemeral Linux microVM powered by Vercel Sandbox',
  configSchema: {
    type: 'object',
    properties: {
      runtime: {
        type: 'string',
        description: 'Runtime image (node24, node22, python3.13)',
        default: 'node24',
      },
      vcpus: { type: 'number', description: 'Number of virtual CPUs (1, 2, 4, 8)', default: 2 },
      timeout: { type: 'number', description: 'Sandbox timeout in ms', default: 300000 },
      ports: {
        type: 'array',
        description: 'Ports to expose publicly',
        items: { type: 'number' },
      },
      env: {
        type: 'object',
        description: 'Environment variables',
        additionalProperties: { type: 'string' },
      },
    },
  },
  createSandbox: config => new VercelSandbox(config),
};
