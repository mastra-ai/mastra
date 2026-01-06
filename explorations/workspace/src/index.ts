/**
 * @mastra/workspace
 *
 * Workspace providers for Mastra agents.
 *
 * The core Workspace class is exported from @mastra/core.
 * This package provides filesystem and sandbox provider implementations.
 *
 * ## Usage
 *
 * ```typescript
 * import { Workspace } from '@mastra/core';
 * import { LocalFilesystem, LocalSandbox } from '@mastra/workspace';
 *
 * // Create a workspace with local filesystem (folder on disk)
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './my-workspace' }),
 *   sandbox: new LocalSandbox(),
 * });
 *
 * await workspace.init();
 * await workspace.writeFile('/hello.txt', 'Hello World!');
 * const result = await workspace.executeCode('console.log("Hi")', { runtime: 'node' });
 * ```
 *
 * ## Available Providers
 *
 * ### Filesystem
 * - `LocalFilesystem` - Folder on disk (recommended for development)
 * - `RamFilesystem` - In-memory (ephemeral, for testing)
 *
 * ### Sandbox
 * - `LocalSandbox` - Runs on host machine (development only)
 *
 * ## Planned Providers
 *
 * ### Filesystem
 * - `AgentFS` - Turso-backed with audit trail
 *
 * ### Sandbox (via ComputeSDK)
 * - `ComputeSDKSandbox` - Access to E2B, Modal, Docker, etc.
 */

// =============================================================================
// Filesystem Providers
// =============================================================================

export { LocalFilesystem, type LocalFilesystemOptions } from './filesystem/providers/local';
export { RamFilesystem, type RamFilesystemOptions } from './filesystem/providers/ram';

// Backwards compatibility alias
export {
  RamFilesystem as MemoryFilesystem,
  type RamFilesystemOptions as MemoryFilesystemOptions,
} from './filesystem/providers/ram';

// =============================================================================
// Sandbox Providers
// =============================================================================

export { LocalSandbox, type LocalSandboxOptions } from './sandbox/providers/local';

// =============================================================================
// Types
// =============================================================================

export type {
  // Filesystem types
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
  // Sandbox types
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
} from './types';

// =============================================================================
// Errors
// =============================================================================

export {
  // Filesystem errors
  FilesystemError,
  FileNotFoundError,
  DirectoryNotFoundError,
  FileExistsError,
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotEmptyError,
  PermissionError,
  // Sandbox errors
  SandboxError,
  SandboxExecutionError,
  SandboxNotReadyError,
  UnsupportedRuntimeError,
} from './types';
