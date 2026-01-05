/**
 * @mastra/workspace
 *
 * Workspace abstraction for Mastra agents.
 * Provides filesystem and executor capabilities at agent and thread levels.
 *
 * ## Usage
 *
 * Consumers should use factory functions which return interface types:
 *
 * ```typescript
 * import { createMemoryWorkspace, type Workspace } from '@mastra/workspace';
 *
 * const workspace: Workspace = await createMemoryWorkspace({
 *   id: 'my-workspace',
 *   scope: 'thread',
 * });
 *
 * await workspace.writeFile('/hello.txt', 'Hello World!');
 * ```
 *
 * For creating new providers, extend the base classes:
 *
 * ```typescript
 * import { BaseFilesystem, BaseExecutor } from '@mastra/workspace';
 * ```
 */

// =============================================================================
// Workspace (Main API)
// =============================================================================

// Interfaces & Types
export type {
  Workspace,
  WorkspaceFactory,
  WorkspaceAudit,
  WorkspaceScope,
  WorkspaceOwner,
  WorkspaceStatus,
  WorkspaceInfo,
  SyncResult,
  SnapshotOptions,
  WorkspaceSnapshot,
  RestoreOptions,
  WorkspaceAuditEntry,
  WorkspaceAuditOptions,
  WorkspaceConfig,
  ThreadWorkspaceConfig,
  ThreadFilesystemConfig,
  ThreadExecutorConfig,
  AgentWorkspaceConfig,
  AgentLevelWorkspaceConfig,
  ThreadLevelWorkspaceConfig,
  HybridWorkspaceConfig,
} from './workspace/types';

// Errors
export {
  WorkspaceError,
  WorkspaceNotFoundError,
  WorkspaceNotReadyError,
  FilesystemNotAvailableError,
  ExecutorNotAvailableError,
  WorkspaceLimitError,
} from './workspace/types';

// Factory Functions (primary API)
export { createWorkspace, createLocalWorkspace, createMemoryWorkspace } from './workspace/workspace';

// Base class for implementers
export { BaseWorkspace } from './workspace/workspace';

// =============================================================================
// Filesystem
// =============================================================================

// Interfaces & Types
export type {
  WorkspaceFilesystem,
  WorkspaceState,
  WorkspaceFilesystemAudit,
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
  WatchEvent,
  WatchCallback,
  WatchOptions,
  WatchHandle,
  AuditEntry,
  AuditOptions,
  FilesystemConfig,
  FilesystemProviderConfig,
  AgentFSProviderConfig,
  LocalFSProviderConfig,
  MemoryFSProviderConfig,
  S3FSProviderConfig,
} from './filesystem/types';

// Errors
export {
  FilesystemError,
  FileNotFoundError,
  DirectoryNotFoundError,
  FileExistsError,
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotEmptyError,
  PermissionError,
} from './filesystem/types';

// Factory Functions
export { createFilesystem, createMemoryFilesystem, createLocalFilesystem } from './filesystem/factory';

// Base class for implementers
export { BaseFilesystem } from './filesystem/base';

// Concrete providers (for advanced use cases)
export { MemoryFilesystem, type MemoryFilesystemOptions } from './filesystem/providers/memory';
export { LocalFilesystem, type LocalFilesystemOptions } from './filesystem/providers/local';

// =============================================================================
// Executor
// =============================================================================

// Interfaces & Types
export type {
  WorkspaceExecutor,
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
  ExecutorConfig,
  ExecutorProviderConfig,
  E2BExecutorConfig,
  ModalExecutorConfig,
  DockerExecutorConfig,
  LocalExecutorConfig,
  DaytonaExecutorConfig,
  ComputeSDKExecutorConfig,
} from './executor/types';

// Errors
export {
  ExecutorError,
  ExecutionError,
  TimeoutError,
  ExecutorNotReadyError,
  UnsupportedRuntimeError,
} from './executor/types';

// Factory Functions
export { createExecutor, createLocalExecutor } from './executor/factory';

// Base class for implementers
export { BaseExecutor } from './executor/base';

// Concrete providers (for advanced use cases)
export { LocalExecutor, type LocalExecutorOptions } from './executor/providers/local';
