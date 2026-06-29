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
  publishedSockets?: string[];
  cpus?: number | string;
  memory?: string;
  platform?: string;
  arch?: string;
  os?: string;
  rosetta?: boolean;
  readonlyRootfs?: boolean;
  ssh?: boolean;
  init?: boolean;
  virtualization?: boolean;
  capAdd?: string[];
  capDrop?: string[];
  tmpfs?: string[];
  dns?: string[];
  dnsSearch?: string[];
  noDns?: boolean;
  labels?: Record<string, string>;
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
      publishedSockets: {
        type: 'array',
        description: 'Socket publish specs',
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
      os: {
        type: 'string',
        description: 'Operating system for multi-platform images',
      },
      rosetta: {
        type: 'boolean',
        description: 'Enable Rosetta in the container',
        default: false,
      },
      readonlyRootfs: {
        type: 'boolean',
        description: 'Mount the container root filesystem as read-only',
        default: false,
      },
      ssh: {
        type: 'boolean',
        description: 'Forward the host SSH agent socket',
        default: false,
      },
      init: {
        type: 'boolean',
        description: "Enable Apple's init process in the container",
        default: true,
      },
      virtualization: {
        type: 'boolean',
        description: 'Expose virtualization capabilities to the container',
        default: false,
      },
      capAdd: {
        type: 'array',
        description: 'Linux capabilities to add',
        items: { type: 'string' },
      },
      capDrop: {
        type: 'array',
        description: 'Linux capabilities to drop',
        items: { type: 'string' },
      },
      tmpfs: {
        type: 'array',
        description: 'tmpfs mount specs',
        items: { type: 'string' },
      },
      dns: {
        type: 'array',
        description: 'DNS nameserver IPs',
        items: { type: 'string' },
      },
      dnsSearch: {
        type: 'array',
        description: 'DNS search domains',
        items: { type: 'string' },
      },
      noDns: {
        type: 'boolean',
        description: 'Do not configure DNS in the container',
        default: false,
      },
      labels: {
        type: 'object',
        description: 'Container labels',
        additionalProperties: { type: 'string' },
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
