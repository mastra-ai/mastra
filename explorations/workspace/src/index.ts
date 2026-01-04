/**
 * @mastra/workspace
 *
 * Workspace abstraction for Mastra agents.
 * Provides filesystem and executor capabilities at agent and thread levels.
 */

// =============================================================================
// Filesystem
// =============================================================================

// Types
export type {
  // Core types
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
  // Interfaces
  WorkspaceFilesystem,
  WorkspaceState,
  WorkspaceFilesystemAudit,
  AuditEntry,
  AuditOptions,
  // Configs
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

// Providers
export { LocalFilesystem, createLocalFilesystem } from './filesystem/local';
export { MemoryFilesystem, createMemoryFilesystem } from './filesystem/memory';

// =============================================================================
// Executor
// =============================================================================

// Types
export type {
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
  // Interfaces
  WorkspaceExecutor,
  // Configs
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

// Providers
export { LocalExecutor, createLocalExecutor } from './executor/local';

// =============================================================================
// Workspace
// =============================================================================

// Types
export type {
  // Core types
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
  WorkspaceAudit,
  // Interfaces
  Workspace,
  WorkspaceFactory,
  // Configs
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

// Factory functions
export {
  BaseWorkspace,
  createWorkspace,
  createLocalWorkspace,
  createMemoryWorkspace,
} from './workspace/workspace';
