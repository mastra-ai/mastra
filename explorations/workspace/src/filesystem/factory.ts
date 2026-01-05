/**
 * Filesystem Factory
 *
 * Factory functions for creating filesystem instances.
 * Returns interface types so consumers depend on contracts, not implementations.
 */

import type { WorkspaceFilesystem, FilesystemConfig, MemoryFSProviderConfig, LocalFSProviderConfig } from './types';
import { MemoryFilesystem } from './providers/memory';
import { LocalFilesystem } from './providers/local';

/**
 * Create a filesystem based on configuration.
 *
 * @param config - Filesystem configuration
 * @returns WorkspaceFilesystem interface
 */
export function createFilesystem(config: FilesystemConfig): WorkspaceFilesystem {
  switch (config.provider) {
    case 'memory':
      return new MemoryFilesystem(config);
    case 'local':
      return new LocalFilesystem(config);
    case 'agentfs':
      throw new Error('AgentFS provider not yet implemented');
    case 's3':
      throw new Error('S3 provider not yet implemented');
    default:
      throw new Error(`Unknown filesystem provider: ${(config as any).provider}`);
  }
}

/**
 * Create an in-memory filesystem.
 *
 * @param options - Configuration options
 * @returns WorkspaceFilesystem interface
 */
export function createMemoryFilesystem(
  options: MemoryFSProviderConfig | { id: string; initialFiles?: Record<string, string | Buffer> },
): WorkspaceFilesystem {
  const config: MemoryFSProviderConfig = {
    provider: 'memory',
    id: options.id,
    initialFiles: 'initialFiles' in options ? options.initialFiles : undefined,
  };
  return new MemoryFilesystem(config);
}

/**
 * Create a local filesystem.
 *
 * @param options - Configuration options
 * @returns WorkspaceFilesystem interface
 */
export function createLocalFilesystem(
  options: LocalFSProviderConfig | { id: string; basePath: string; sandbox?: boolean },
): WorkspaceFilesystem {
  const config: LocalFSProviderConfig = {
    provider: 'local',
    id: options.id,
    basePath: options.basePath,
    sandbox: 'sandbox' in options ? options.sandbox : true,
  };
  return new LocalFilesystem(config);
}
