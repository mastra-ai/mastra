/**
 * Workspace Sandbox Interface
 *
 * Defines the contract for sandbox providers that can be used with Workspace.
 * Users pass sandbox provider instances to the Workspace constructor.
 *
 * Sandboxes provide isolated environments for code and command execution.
 * They may have their own filesystem that's separate from the workspace FS.
 *
 * Built-in providers (via ComputeSDK):
 * - E2B: Cloud sandboxes
 * - Modal: GPU-enabled sandboxes
 * - Docker: Container-based execution
 * - Local: Development-only local execution
 *
 * @example
 * ```typescript
 * import { Workspace } from '@mastra/core';
 * import { ComputeSDKSandbox } from '@mastra/workspace-sandbox-computesdk';
 *
 * const workspace = new Workspace({
 *   sandbox: new ComputeSDKSandbox({ provider: 'e2b' }),
 * });
 * ```
 */

import type { RequestContext } from '../../request-context';
import type { WorkspaceFilesystem } from '../filesystem/filesystem';
import type { MountResult } from '../filesystem/mount';
import type { SandboxLifecycle } from '../lifecycle';

import type { MountManager } from './mount-manager';
import type { SandboxProcessManager } from './process-manager';
import type { CommandResult, ExecuteCommandOptions, SandboxInfo } from './types';

// =============================================================================
// Sandbox Interface
// =============================================================================

/**
 * Abstract sandbox interface for code and command execution.
 *
 * Providers implement this interface to provide execution capabilities.
 * Users instantiate providers and pass them to the Workspace constructor.
 *
 * Sandboxes provide isolated environments for running untrusted code.
 * They may have their own filesystem that's separate from the workspace FS.
 *
 * Lifecycle methods (from SandboxLifecycle interface) are all optional:
 * - start(): Begin operation (spin up instance)
 * - stop(): Pause operation (pause instance)
 * - destroy(): Clean up resources (terminate instance)
 * - isReady(): Check if ready for operations
 * - getInfo(): Get status and metadata
 */
export interface WorkspaceSandbox extends SandboxLifecycle<SandboxInfo> {
  /** Unique identifier for this sandbox instance */
  readonly id: string;

  /** Human-readable name (e.g., 'E2B Sandbox', 'Docker') */
  readonly name: string;

  /** Provider type identifier */
  readonly provider: string;

  /**
   * Get instructions describing how this sandbox works.
   * Used in tool descriptions to help agents understand execution context.
   *
   * @param opts - Optional options including request context for per-request customisation
   * @returns A string describing how to use this sandbox
   */
  getInstructions?(opts?: { requestContext?: RequestContext }): string;

  // ---------------------------------------------------------------------------
  // Command Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute a shell command and wait for it to complete.
   * Optional - if not implemented, the workspace_execute_command tool won't be available.
   *
   * @example
   * ```typescript
   * await sandbox.executeCommand('npm install');
   *
   * // With options
   * await sandbox.executeCommand('npm install', [], { timeout: 60000 });
   *
   * // With args array (each arg is shell-quoted automatically)
   * await sandbox.executeCommand('npm', ['install'], { timeout: 60000 });
   * ```
   *
   * @throws {SandboxExecutionError} if command fails to start
   * @throws {SandboxTimeoutError} if command times out
   */
  executeCommand?(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult>;

  // ---------------------------------------------------------------------------
  // Process Management (Optional)
  // ---------------------------------------------------------------------------

  /**
   * Process manager.
   * Optional - if not implemented, process management tools won't be available.
   *
   * Provides methods to spawn long-running processes, list them, and interact
   * with them via their {@link ProcessHandle} (kill, sendStdin, wait, read output).
   *
   * @example
   * ```typescript
   * const handle = await sandbox.processes.spawn('node server.js');
   * console.log(handle.pid);
   *
   * const procs = await sandbox.processes.list();
   * const proc = await sandbox.processes.get(handle.pid);
   * await proc?.sendStdin('hello\n');
   * await proc?.kill();
   * ```
   */
  readonly processes?: SandboxProcessManager;

  // ---------------------------------------------------------------------------
  // Mounting Support (Optional)
  // ---------------------------------------------------------------------------

  /**
   * Mount manager for tracking and processing filesystem mounts.
   * Only available if the sandbox implements mount().
   *
   * @example
   * ```typescript
   * // Add pending mounts
   * sandbox.mounts?.add({ '/data': s3fs });
   *
   * // Check mount entries
   * const entries = sandbox.mounts?.entries;
   * ```
   */
  readonly mounts?: MountManager;

  /**
   * Mount a filesystem at a path in the sandbox.
   * Uses FUSE tools (s3fs, gcsfuse) to mount cloud storage.
   *
   * @param filesystem - The filesystem to mount
   * @param mountPath - Path in the sandbox where filesystem should be mounted
   * @returns Mount result with success status and mount path
   * @throws {MountError} if mount fails
   * @throws {MountNotSupportedError} if sandbox doesn't support mounting
   * @throws {FilesystemNotMountableError} if filesystem cannot be mounted
   */
  mount?(filesystem: WorkspaceFilesystem, mountPath: string): Promise<MountResult>;

  /**
   * Unmount a filesystem from a path in the sandbox.
   *
   * @param mountPath - Path to unmount
   */
  unmount?(mountPath: string): Promise<void>;
}
