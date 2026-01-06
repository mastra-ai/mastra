/**
 * Workspace Module
 *
 * Provides the core Workspace class, interfaces, and built-in providers
 * for filesystem and sandbox capabilities.
 *
 * @example
 * ```typescript
 * import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core';
 *
 * // Workspace with local filesystem and sandbox
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './my-workspace' }),
 *   sandbox: new LocalSandbox({ workingDirectory: './my-workspace' }),
 * });
 *
 * await workspace.init();
 * await workspace.writeFile('/hello.txt', 'Hello World!');
 * const result = await workspace.executeCode('console.log("Hi")', { runtime: 'node' });
 * ```
 *
 * For cloud/remote providers, import them from their respective packages:
 *
 * ```typescript
 * import { Workspace } from '@mastra/core';
 * import { AgentFS } from '@mastra/filesystem-agentfs';
 * import { ComputeSDKSandbox } from '@mastra/sandbox-computesdk';
 *
 * const cloudWorkspace = new Workspace({
 *   filesystem: new AgentFS({ path: './agent.db' }),
 *   sandbox: new ComputeSDKSandbox({ provider: 'e2b' }),
 * });
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

export type { InstallPackageResult } from './sandbox';

// =============================================================================
// Built-in Providers
// =============================================================================

export { LocalFilesystem, type LocalFilesystemOptions } from './local-filesystem';
export { LocalSandbox, type LocalSandboxOptions } from './local-sandbox';
