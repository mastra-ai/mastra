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
  /** Memory limit in bytes */
  memory?: number;
  /** Total memory plus swap in bytes */
  memorySwap?: number;
  /** CPU shares relative weight */
  cpuShares?: number;
  /** CPU quota in microseconds per period */
  cpuQuota?: number;
  /** CPU period in microseconds */
  cpuPeriod?: number;
  /** Maximum number of PIDs in the container */
  pidsLimit?: number;
  /** Mount the container root filesystem as read-only */
  readonlyRootfs?: boolean;
  /** Linux capabilities to drop */
  capDrop?: string[];
  /** Linux capabilities to add */
  capAdd?: string[];
  /** Docker security options */
  securityOpt?: string[];
  /** Ulimit entries for Docker HostConfig.Ulimits */
  ulimits?: DockerSandboxOptions['ulimits'];
  /** tmpfs mount paths with options */
  tmpfs?: DockerSandboxOptions['tmpfs'];
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
      memory: {
        type: 'number',
        description: 'Memory limit in bytes',
      },
      memorySwap: {
        type: 'number',
        description: 'Total memory plus swap in bytes',
      },
      cpuShares: {
        type: 'number',
        description: 'CPU shares relative weight',
      },
      cpuQuota: {
        type: 'number',
        description: 'CPU quota in microseconds per period',
      },
      cpuPeriod: {
        type: 'number',
        description: 'CPU period in microseconds',
      },
      pidsLimit: {
        type: 'number',
        description: 'Maximum number of PIDs in the container',
      },
      readonlyRootfs: {
        type: 'boolean',
        description: 'Mount the container root filesystem as read-only',
      },
      capDrop: {
        type: 'array',
        description: 'Linux capabilities to drop',
        items: { type: 'string' },
      },
      capAdd: {
        type: 'array',
        description: 'Linux capabilities to add',
        items: { type: 'string' },
      },
      securityOpt: {
        type: 'array',
        description: 'Docker security options',
        items: { type: 'string' },
      },
      ulimits: {
        type: 'array',
        description: 'Ulimit entries for Docker HostConfig.Ulimits',
        items: {
          type: 'object',
          required: ['name', 'soft', 'hard'],
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            soft: { type: 'number' },
            hard: { type: 'number' },
          },
        },
      },
      tmpfs: {
        type: 'object',
        description: 'tmpfs mount paths with options',
        additionalProperties: { type: 'string' },
      },
    },
  },
  createSandbox: (config: DockerProviderConfig) => new DockerSandbox(config as DockerSandboxOptions),
};
