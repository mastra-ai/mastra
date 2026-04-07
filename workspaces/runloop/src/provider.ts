/**
 * Runloop sandbox provider descriptor for MastraEditor.
 */

import type { SandboxProvider } from '@mastra/core/editor';

import { RunloopSandbox } from './sandbox';

/** Serializable subset of RunloopSandboxOptions for editor storage. */
interface RunloopProviderConfig {
  apiKey?: string;
  baseURL?: string | null;
  clientTimeout?: number;
  timeout?: number;
  devboxName?: string;
  env?: Record<string, string>;
  metadata?: Record<string, string>;
  blueprintId?: string | null;
  blueprintName?: string | null;
  snapshotId?: string | null;
}

export const runloopSandboxProvider: SandboxProvider<RunloopProviderConfig> = {
  id: 'runloop',
  name: 'Runloop Sandbox',
  description: 'Cloud sandbox powered by Runloop Devboxes',
  configSchema: {
    type: 'object',
    properties: {
      apiKey: { type: 'string', description: 'Runloop API key (defaults to RUNLOOP_API_KEY)' },
      baseURL: { type: 'string', description: 'API base URL (defaults to RUNLOOP_BASE_URL)' },
      clientTimeout: { type: 'number', description: 'HTTP client timeout in milliseconds' },
      timeout: { type: 'number', description: 'Default command / long-poll timeout in ms', default: 300000 },
      devboxName: { type: 'string', description: 'Devbox display name on Runloop' },
      env: {
        type: 'object',
        description: 'Environment variables on the devbox',
        additionalProperties: { type: 'string' },
      },
      metadata: {
        type: 'object',
        description: 'Devbox metadata (string map)',
        additionalProperties: { type: 'string' },
      },
      blueprintId: { type: 'string', description: 'Blueprint ID to create the devbox from' },
      blueprintName: { type: 'string', description: 'Blueprint name to create the devbox from' },
      snapshotId: { type: 'string', description: 'Snapshot ID to create the devbox from' },
    },
  },
  createSandbox: config => new RunloopSandbox(config),
};
