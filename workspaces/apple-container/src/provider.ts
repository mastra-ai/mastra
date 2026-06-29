/**
 * Apple container sandbox provider descriptor for MastraEditor.
 */

import type { SandboxProvider } from '@mastra/core/editor';
import { AppleContainerSandbox } from './sandbox';
import type { AppleContainerSandboxOptions } from './sandbox';

export type AppleContainerProviderConfig = Pick<
  AppleContainerSandboxOptions,
  | 'id'
  | 'image'
  | 'name'
  | 'command'
  | 'env'
  | 'volumes'
  | 'mounts'
  | 'network'
  | 'publishedPorts'
  | 'publishedSockets'
  | 'cpus'
  | 'memory'
  | 'platform'
  | 'arch'
  | 'os'
  | 'rosetta'
  | 'readonlyRootfs'
  | 'ssh'
  | 'init'
  | 'virtualization'
  | 'capAdd'
  | 'capDrop'
  | 'tmpfs'
  | 'dns'
  | 'dnsSearch'
  | 'noDns'
  | 'labels'
  | 'workingDir'
  | 'timeout'
  | 'deleteOnDestroy'
>;

export const appleContainerSandboxProvider: SandboxProvider<AppleContainerProviderConfig> = {
  id: 'apple-container',
  name: 'Apple Container Sandbox',
  description: 'Local OCI Linux container sandbox powered by Apple container',
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      id: {
        type: 'string',
        description: 'Stable sandbox ID used for reconnecting to the same Apple container.',
      },
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
        description: 'tmpfs destination paths',
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
    },
  },
  createSandbox: config => {
    const {
      id,
      image,
      name,
      command,
      env,
      volumes,
      mounts,
      network,
      publishedPorts,
      publishedSockets,
      cpus,
      memory,
      platform,
      arch,
      os,
      rosetta,
      readonlyRootfs,
      ssh,
      init,
      virtualization,
      capAdd,
      capDrop,
      tmpfs,
      dns,
      dnsSearch,
      noDns,
      labels,
      workingDir,
      timeout,
      deleteOnDestroy,
    } = config;

    return new AppleContainerSandbox({
      id,
      image,
      name,
      command,
      env,
      volumes,
      mounts,
      network,
      publishedPorts,
      publishedSockets,
      cpus,
      memory,
      platform,
      arch,
      os,
      rosetta,
      readonlyRootfs,
      ssh,
      init,
      virtualization,
      capAdd,
      capDrop,
      tmpfs,
      dns,
      dnsSearch,
      noDns,
      labels,
      workingDir,
      timeout,
      deleteOnDestroy,
    });
  },
};
