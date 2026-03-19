/**
 * Built-in workspace provider descriptors.
 *
 * These are auto-registered by MastraEditor and always available.
 * External providers (S3, GCS, E2B) are supplied via MastraEditorConfig.
 */
import type { FilesystemProvider, SandboxProvider } from '@mastra/core/editor';
import { LocalFilesystem } from '@mastra/core/workspace';
import { LocalSandbox } from '@mastra/core/workspace';

export const localFilesystemProvider: FilesystemProvider<{
  basePath: string;
  contained?: boolean;
  readOnly?: boolean;
}> = {
  id: 'local',
  name: 'Local Filesystem',
  description: 'A folder on the local disk',
  configSchema: {
    type: 'object',
    required: ['basePath'],
    properties: {
      basePath: { type: 'string', description: 'Base directory path on disk' },
      contained: {
        type: 'boolean',
        description: 'Restrict operations to stay within basePath',
        default: true,
      },
      readOnly: {
        type: 'boolean',
        description: 'Block all write operations',
        default: false,
      },
    },
  },
  createFilesystem: config => new LocalFilesystem(config),
};

export const localSandboxProvider: SandboxProvider<{
  workingDirectory?: string;
  timeout?: number;
  isolation?: 'none' | 'seatbelt' | 'bwrap';
  env?: Record<string, string>;
}> = {
  id: 'local',
  name: 'Local Sandbox',
  description: 'Execute commands on the local machine',
  configSchema: {
    type: 'object',
    properties: {
      workingDirectory: { type: 'string', description: 'Working directory for command execution' },
      timeout: { type: 'number', description: 'Default timeout for operations in ms' },
      isolation: {
        type: 'string',
        enum: ['none', 'seatbelt', 'bwrap'],
        description: 'Isolation backend for sandboxed execution',
        default: 'none',
      },
      env: {
        type: 'object',
        description: 'Environment variables for command execution',
        additionalProperties: { type: 'string' },
      },
    },
  },
  createSandbox: config => new LocalSandbox(config),
};
