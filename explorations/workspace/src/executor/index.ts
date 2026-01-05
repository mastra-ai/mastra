/**
 * Executor Module
 *
 * Exports the executor interface, factory functions, and types.
 * Consumers should use factory functions which return interface types.
 */

// ============================================================================
// Interface & Types (primary exports for consumers)
// ============================================================================

export type {
  // Core interface
  WorkspaceExecutor,

  // Core types
  Runtime,
  ExecutionResult,
  CommandResult,
  CodeResult,
  StreamingExecutionResult,
  ExecuteCodeOptions,
  ExecuteCommandOptions,
  InstallPackageOptions,
  ExecutorStatus,
  ExecutorInfo,

  // Configuration types
  ExecutorConfig,
  ExecutorProviderConfig,
  E2BExecutorConfig,
  ModalExecutorConfig,
  DockerExecutorConfig,
  LocalExecutorConfig,
  DaytonaExecutorConfig,
  ComputeSDKExecutorConfig,
} from './types';

// Errors
export {
  ExecutorError,
  ExecutionError,
  TimeoutError,
  ExecutorNotReadyError,
  UnsupportedRuntimeError,
} from './types';

// ============================================================================
// Factory Functions (recommended way to create instances)
// ============================================================================

export { createExecutor, createLocalExecutor } from './factory';

// ============================================================================
// Base Class (for implementers creating new providers)
// ============================================================================

export { BaseExecutor } from './base';

// ============================================================================
// Provider Implementations (for advanced use cases)
// ============================================================================

// Export concrete implementations for cases where direct instantiation is needed
export { LocalExecutor, type LocalExecutorOptions } from './providers/local';
