/**
 * Vercel serverless sandbox provider descriptor for MastraEditor.
 *
 * @example
 * ```typescript
 * import { vercelServerlessSandboxProvider } from '@mastra/vercel';
 *
 * const editor = new MastraEditor({
 *   sandboxes: [vercelServerlessSandboxProvider],
 * });
 * ```
 */
import type { SandboxProvider } from '@mastra/core/editor';
import { VercelServerlessSandbox } from './serverless';

/**
 * Serializable subset of VercelServerlessSandboxOptions for editor storage.
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

export const vercelServerlessSandboxProvider: SandboxProvider<VercelProviderConfig> = {
  id: 'vercel-serverless',
  name: 'Vercel Sandbox (Serverless)',
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
  createSandbox: config => new VercelServerlessSandbox(config),
};
