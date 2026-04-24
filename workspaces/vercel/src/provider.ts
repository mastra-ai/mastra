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
  token?: string;
  teamId?: string;
  projectName?: string;
  regions?: string[];
  maxDuration?: number;
  memory?: number;
  env?: Record<string, string>;
  commandTimeout?: number;
}

export const vercelSandboxProvider: SandboxProvider<VercelProviderConfig> = {
  id: 'vercel',
  name: 'Vercel Sandbox',
  description: 'Serverless sandbox powered by Vercel Functions',
  configSchema: {
    type: 'object',
    properties: {
      token: { type: 'string', description: 'Vercel API token' },
      teamId: { type: 'string', description: 'Vercel team ID' },
      projectName: { type: 'string', description: 'Existing Vercel project name' },
      regions: {
        type: 'array',
        description: 'Deployment regions',
        items: { type: 'string' },
        default: ['iad1'],
      },
      maxDuration: { type: 'number', description: 'Function max duration in seconds', default: 60 },
      memory: { type: 'number', description: 'Function memory in MB', default: 1024 },
      env: {
        type: 'object',
        description: 'Environment variables',
        additionalProperties: { type: 'string' },
      },
      commandTimeout: { type: 'number', description: 'Per-invocation timeout in ms', default: 55000 },
    },
  },
  createSandbox: config => new VercelSandbox(config),
};
