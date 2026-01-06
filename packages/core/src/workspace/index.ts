/**
 * Workspace Module
 *
 * Provides the core Workspace class and interfaces for filesystem and sandbox providers.
 *
 * @example
 * ```typescript
 * import { Workspace } from '@mastra/core';
 * import { LocalFilesystem } from '@mastra/workspace-fs-local';
 * import { AgentFS } from '@mastra/workspace-fs-agentfs';
 * import { ComputeSDKSandbox } from '@mastra/workspace-sandbox-computesdk';
 *
 * // Workspace with local filesystem (folder on disk)
 * const localWorkspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './my-workspace' }),
 * });
 *
 * // Workspace with AgentFS (Turso-backed) and cloud sandbox
 * const fullWorkspace = new Workspace({
 *   filesystem: new AgentFS({ path: './agent.db' }),
 *   sandbox: new ComputeSDKSandbox({ provider: 'e2b' }),
 * });
 *
 * await fullWorkspace.init();
 * await fullWorkspace.writeFile('/hello.txt', 'Hello World!');
 * const result = await fullWorkspace.executeCode('print("Hi")', { runtime: 'python' });
 * ```
 */

// =============================================================================
// Workspace (Main API)
// =============================================================================

export {
  Workspace,
  WorkspaceError,
  FilesystemNotAvailableError,
  SandboxNotAvailableError,
  WorkspaceNotReadyError,
  type WorkspaceConfig,
  type WorkspaceScope,
  type WorkspaceOwner,
  type WorkspaceStatus,
  type WorkspaceInfo,
  type SyncResult,
  type SnapshotOptions,
  type WorkspaceSnapshot,
  type RestoreOptions,
} from './workspace';

// =============================================================================
// Filesystem Interface (for provider implementers)
// =============================================================================

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
  FilesystemAuditEntry,
  FilesystemAuditOptions,
} from './filesystem';

export {
  FilesystemError,
  FileNotFoundError,
  DirectoryNotFoundError,
  FileExistsError,
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotEmptyError,
  PermissionError,
} from './filesystem';

// =============================================================================
// Sandbox Interface (for provider implementers)
// =============================================================================

export type {
  WorkspaceSandbox,
  SandboxRuntime,
  ExecutionResult,
  CommandResult,
  CodeResult,
  StreamingExecutionResult,
  ExecuteCodeOptions,
  ExecuteCommandOptions,
  InstallPackageOptions,
  SandboxStatus,
  SandboxInfo,
} from './sandbox';

export {
  SandboxError,
  SandboxExecutionError,
  SandboxTimeoutError,
  SandboxNotReadyError,
  UnsupportedRuntimeError,
} from './sandbox';
