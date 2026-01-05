/**
 * Executor Factory
 *
 * Factory functions for creating executor instances.
 * Returns interface types so consumers depend on contracts, not implementations.
 */

import type { WorkspaceExecutor, ExecutorConfig, LocalExecutorConfig, Runtime } from './types';
import { LocalExecutor } from './providers/local';

/**
 * Create an executor based on configuration.
 *
 * @param config - Executor configuration
 * @returns WorkspaceExecutor interface
 */
export function createExecutor(config: ExecutorConfig): WorkspaceExecutor {
  switch (config.provider) {
    case 'local':
      return new LocalExecutor(config);
    case 'e2b':
      throw new Error('E2B provider not yet implemented');
    case 'modal':
      throw new Error('Modal provider not yet implemented');
    case 'docker':
      throw new Error('Docker provider not yet implemented');
    case 'daytona':
      throw new Error('Daytona provider not yet implemented');
    case 'computesdk':
      throw new Error('ComputeSDK provider not yet implemented');
    default:
      throw new Error(`Unknown executor provider: ${(config as any).provider}`);
  }
}

/**
 * Create a local executor.
 *
 * @param options - Configuration options
 * @returns WorkspaceExecutor interface
 */
export function createLocalExecutor(
  options:
    | LocalExecutorConfig
    | {
        id: string;
        cwd?: string;
        shell?: boolean;
        allowedCommands?: string[];
        timeout?: number;
        env?: Record<string, string>;
        defaultRuntime?: Runtime;
      },
): WorkspaceExecutor {
  const config: LocalExecutorConfig = {
    provider: 'local',
    id: options.id,
    cwd: options.cwd,
    shell: options.shell,
    allowedCommands: options.allowedCommands,
    timeout: options.timeout,
    env: options.env,
    defaultRuntime: options.defaultRuntime,
  };
  return new LocalExecutor(config);
}
