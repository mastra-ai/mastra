/**
 * Vercel Sandbox (MicroVM) provider descriptor for MastraEditor.
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
import { VercelSandbox } from './microvm';

/**
 * Serializable subset of VercelSandboxOptions for editor storage.
 */
interface VercelSandboxProviderConfig {
  token?: string;
  teamId?: string;
  projectId?: string;
  runtime?: 'node24' | 'node22' | 'node26' | 'python3.13';
  timeout?: number;
  vcpus?: number;
  ports?: number[];
  env?: Record<string, string>;
}

export const vercelSandboxProvider: SandboxProvider<VercelSandboxProviderConfig> = {
  id: 'vercel-sandbox',
  name: 'Vercel Sandbox (MicroVM)',
  description: 'Ephemeral Firecracker MicroVM sandbox powered by Vercel Sandbox',
  configSchema: {
    type: 'object',
    properties: {
      token: { type: 'string', description: 'Vercel API token (falls back to VERCEL_TOKEN; omit to use OIDC)' },
      teamId: { type: 'string', description: 'Vercel team ID (falls back to VERCEL_TEAM_ID)' },
      projectId: { type: 'string', description: 'Vercel project ID (falls back to VERCEL_PROJECT_ID)' },
      runtime: {
        type: 'string',
        description: 'Sandbox runtime',
        enum: ['node24', 'node22', 'node26', 'python3.13'],
        default: 'node24',
      },
      timeout: { type: 'number', description: 'Auto-terminate timeout in milliseconds', default: 300000 },
      vcpus: { type: 'number', description: 'Number of vCPUs (2048 MB memory per vCPU)' },
      ports: {
        type: 'array',
        description: 'Ports to expose (up to 4)',
        items: { type: 'number' },
      },
      env: {
        type: 'object',
        description: 'Environment variables',
        additionalProperties: { type: 'string' },
      },
    },
  },
  createSandbox: config =>
    new VercelSandbox({
      token: config.token,
      teamId: config.teamId,
      projectId: config.projectId,
      runtime: config.runtime,
      timeout: config.timeout,
      ...(config.vcpus ? { resources: { vcpus: config.vcpus } } : {}),
      ports: config.ports,
      env: config.env,
    }),
};
