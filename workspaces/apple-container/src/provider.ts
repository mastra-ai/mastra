/**
 * Apple container sandbox provider descriptor for MastraEditor.
 */

import type { SandboxProvider } from '@mastra/core/editor';
import { AppleContainerSandbox } from './sandbox';
import type { AppleContainerSandboxOptions } from './sandbox';

export interface AppleContainerProviderConfig {
  image?: string;
  name?: string;
  command?: string[];
  env?: Record<string, string>;
  volumes?: Record<string, string>;
  mounts?: string[];
  network?: string;
  publishedPorts?: string[];
  cpus?: number | string;
  memory?: string;
  platform?: string;
  arch?: string;
  rosetta?: boolean;
  readOnlyRootfs?: boolean;
  ssh?: boolean;
  workingDir?: string;
  timeout?: number;
  deleteOnDestroy?: boolean;
  containerBinary?: string;
}

export const appleContainerSandboxProvider: SandboxProvider<AppleContainerProviderConfig> = {
  id: 'apple-container',
  name: 'Apple Container Sandbox',
  description: 'Local OCI Linux container sandbox powered by Apple container',
  configSchema: {
    type: 'object',
    properties: {
      image: {
        type: 'string',
        description: 'OCI image to use',
        default: 'node:22-slim',
      },
      name: {
        type: 'string',
        description: 'Apple container name. Defaults to the sandbox ID.',
      },
      command: {
        type: 'array',
        description: 'Container init command. Must keep the container alive for exec-based command execution.',
        items: { type: 'string' },
      },
      env: {
        type: 'object',
        description: 'Environment variables',
        additionalProperties: { type: 'string' },
      },
      volumes: {
        type: 'object',
        description: 'Host-to-container bind mounts (host path -> container path)',
        additionalProperties: { type: 'string' },
      },
      mounts: {
        type: 'array',
        description: 'Raw Apple container --mount specs',
        items: { type: 'string' },
      },
      network: {
        type: 'string',
        description: 'Apple container network attachment spec',
      },
      publishedPorts: {
        type: 'array',
        description: 'Port publish specs',
        items: { type: 'string' },
      },
      cpus: {
        anyOf: [{ type: 'number' }, { type: 'string' }],
        description: 'Number of CPUs to allocate',
      },
      memory: {
        type: 'string',
        description: 'Memory allocation, for example 1G',
      },
      platform: {
        type: 'string',
        description: 'OCI platform, for example linux/arm64',
      },
      arch: {
        type: 'string',
        description: 'Image architecture for multi-arch images',
      },
      rosetta: {
        type: 'boolean',
        description: 'Enable Rosetta in the container',
        default: false,
      },
      readOnlyRootfs: {
        type: 'boolean',
        description: 'Mount the container root filesystem as read-only',
        default: false,
      },
      ssh: {
        type: 'boolean',
        description: 'Forward the host SSH agent socket',
        default: false,
      },
      workingDir: {
        type: 'string',
        description: 'Working directory inside the container',
        default: '/workspace',
      },
      timeout: {
        type: 'number',
        description: 'Default command timeout in milliseconds',
        default: 300_000,
      },
      deleteOnDestroy: {
        type: 'boolean',
        description: 'Delete the Apple container on destroy',
        default: true,
      },
      containerBinary: {
        type: 'string',
        description: 'Path or name for the Apple container CLI',
        default: 'container',
      },
    },
  },
  createSandbox: config => new AppleContainerSandbox(config as AppleContainerSandboxOptions),
};
