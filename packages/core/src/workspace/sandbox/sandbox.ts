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
// Networking Capability
// =============================================================================

/**
 * Optional networking capability for sandboxes that can expose ports publicly.
 *
 * Providers that support public port exposure (Vercel Sandbox, E2B, Daytona,
 * Modal, Blaxel, etc.) implement this to surface public URLs through the
 * abstraction. Enables preview URLs and sandbox deploys.
 */
export interface SandboxNetworking {
  /**
   * Get the public URL for an exposed port.
   *
   * @param port - The port number inside the sandbox
   * @returns The public URL for the port, or null if the port is not exposed
   *   or the sandbox is not running
   */
  getPortUrl(port: number): Promise<string | null>;
}

/** A file to write into the sandbox filesystem via {@link WorkspaceSandbox.writeFiles}. */
export interface SandboxFileInput {
  /** Destination path inside the sandbox */
  path: string;
  /** File contents */
  content: string | Buffer;
}

/**
 * Type guard: does this sandbox support the networking capability?
 *
 * @example
 * ```typescript
 * if (supportsNetworking(sandbox)) {
 *   const url = await sandbox.networking.getPortUrl(4111);
 * }
 * ```
 */
export function supportsNetworking(
  sandbox: WorkspaceSandbox,
): sandbox is WorkspaceSandbox & { networking: SandboxNetworking } {
  return typeof sandbox.networking?.getPortUrl === 'function';
}

// =============================================================================
// Sandbox Derivation
// =============================================================================

/**
 * Options for cloning a configured sandbox's configuration into an independent
 * sibling sandbox. See {@link WorkspaceSandbox.clone}.
 */
export interface SandboxCloneOptions {
  /** Unique identifier for the sandbox clone instance. */
  id?: string;
  /**
   * Reattach to an existing provider sandbox (by the provider's own id)
   * instead of provisioning a new one.
   */
  sandboxId?: string;
  /** Environment variables baked into the sandbox clone. */
  env?: Record<string, string>;
  /** Provider working directory for the sandbox clone. */
  workingDirectory?: string;
  /** Idle teardown window (minutes) for the sandbox clone. */
  idleTimeoutMinutes?: number;
  /**
   * Provider checkpoint used to seed and preserve the sandbox clone.
   * Providers without checkpoint support may ignore this option.
   */
  checkpointName?: string;
}

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
  // Cloning (Optional)
  // ---------------------------------------------------------------------------

  /**
   * Construct an independent sibling sandbox that inherits this sandbox's
   * configuration (credentials, provider settings, defaults) with
   * per-instance overrides.
   *
   * Performs no I/O — the sandbox clone provisions (or reattaches, when
   * `sandboxId` is set) on its own `start()`. Implement this when one
   * configured sandbox should act as the template for a fleet of independent
   * sandboxes (e.g. one per project).
   *
   * Optional — consumers that need fleets (like the MastraCode web factory)
   * only support sandboxes that implement it.
   */
  clone?(options?: SandboxCloneOptions): WorkspaceSandbox;

  // ---------------------------------------------------------------------------
  // Environment
  // ---------------------------------------------------------------------------

  /** Update an environment variable used by future sandbox commands. */
  setEnvironmentVariable?(name: string, value: string): void;

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
  // Networking (Optional)
  // ---------------------------------------------------------------------------

  /**
   * Networking capability for sandboxes that can expose ports publicly.
   * Optional - only available on providers that support public port exposure.
   * Enables preview URLs and sandbox deploys.
   *
   * @example
   * ```typescript
   * const url = await sandbox.networking?.getPortUrl(4111);
   * ```
   */
  readonly networking?: SandboxNetworking;

  // ---------------------------------------------------------------------------
  // File Upload (Optional)
  // ---------------------------------------------------------------------------

  /**
   * Bulk-write files into the sandbox's own filesystem.
   * Optional fast path - providers with a native file-upload API implement this.
   * Callers should fall back to `executeCommand` when unavailable.
   *
   * @example
   * ```typescript
   * await sandbox.writeFiles?.([{ path: '/app/index.mjs', content: bundle }]);
   * ```
   */
  writeFiles?(files: SandboxFileInput[]): Promise<void>;

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
