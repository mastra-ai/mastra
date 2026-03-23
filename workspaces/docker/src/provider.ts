/**
 * Docker Sandbox Provider Descriptor
 *
 * Enables registration with MastraEditor for UI-driven sandbox configuration.
 */

import type { SandboxProvider } from '@mastra/core/editor';
import { DockerSandbox } from './sandbox';
import type { DockerSandboxOptions } from './sandbox';

/**
 * Serializable config for the Docker sandbox provider.
 * This is the subset of DockerSandboxOptions that can be stored in a config file
 * and rendered in a UI form.
 */
export interface DockerProviderConfig {
  /** Docker image to use */
  image?: string;
  /** Default command timeout in milliseconds */
  timeout?: number;
  /** Environment variables */
  env?: Record<string, string>;
  /** Host-to-container bind mounts */
  volumes?: Record<string, string>;
  /** Docker network to join */
  network?: string;
  /** Working directory inside the container */
  workingDir?: string;
  /** Run in privileged mode */
  privileged?: boolean;
}

export const dockerSandboxProvider: SandboxProvider<DockerProviderConfig> = {
  id: 'docker',
  name: 'Docker Sandbox',
  description: 'Local container sandbox powered by Docker',
  configSchema: {
    type: 'object',
    properties: {
      image: {
        type: 'string',
        description: 'Docker image to use',
        default: 'node:22-slim',
      },
      timeout: {
        type: 'number',
        description: 'Default command timeout in milliseconds',
        default: 300_000,
      },
      env: {
        type: 'object',
        description: 'Environment variables',
        additionalProperties: { type: 'string' },
      },
      volumes: {
        type: 'object',
        description: 'Host-to-container bind mounts (host path → container path)',
        additionalProperties: { type: 'string' },
      },
      network: {
        type: 'string',
        description: 'Docker network to join',
      },
      workingDir: {
        type: 'string',
        description: 'Working directory inside the container',
        default: '/workspace',
      },
      privileged: {
        type: 'boolean',
        description: 'Run in privileged mode',
        default: false,
      },
    },
  },
  createSandbox: (config: DockerProviderConfig) => new DockerSandbox(config as DockerSandboxOptions),
};
