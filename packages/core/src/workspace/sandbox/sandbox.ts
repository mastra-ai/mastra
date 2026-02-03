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

import { createHash } from 'node:crypto';

import { MastraBase } from '../../base';
import { RegisteredLogger } from '../../logger';
import type { WorkspaceFilesystem } from '../filesystem/filesystem';
import type { FilesystemMountConfig, MountResult } from '../filesystem/mount';
import type { Lifecycle, ProviderStatus } from '../lifecycle';

// =============================================================================
// Mount State Types
// =============================================================================

/**
 * State of a mount in the sandbox.
 */
export type MountState = 'pending' | 'mounting' | 'mounted' | 'error' | 'unsupported';

/**
 * Entry representing a mount in the sandbox.
 */
export interface MountEntry {
  /** The filesystem to mount */
  filesystem: WorkspaceFilesystem;
  /** Current state of the mount */
  state: MountState;
  /** Error message if state is 'error' */
  error?: string;
  /** Whether to mount into sandbox (false = workspace API only) */
  sandboxMount: boolean;
  /** Resolved mount config from filesystem.getMountConfig() */
  config?: FilesystemMountConfig;
  /** Hash of config for quick comparison */
  configHash?: string;
}

export abstract class BaseSandbox extends MastraBase implements WorkspaceSandbox {
  /** Unique identifier for this sandbox instance */
  abstract readonly id: string;
  /** Human-readable name (e.g., 'E2B Sandbox', 'Docker') */
  abstract override readonly name: string;
  /** Provider type identifier */
  abstract readonly provider: string;
  abstract status: ProviderStatus;

  /** Track mounts with their state */
  protected _mounts: Map<string, MountEntry> = new Map();

  constructor(options: { name: string }) {
    super({ name: options.name, component: RegisteredLogger.WORKSPACE });
  }

  // ---------------------------------------------------------------------------
  // Mount Management
  // ---------------------------------------------------------------------------

  /**
   * Set mounts that should be mounted into the sandbox.
   * Called by Workspace to inform sandbox of pending mounts.
   * Mounts will be processed when start() is called.
   */
  setMounts(mounts: Record<string, { filesystem: WorkspaceFilesystem; sandboxMount: boolean }>): void {
    for (const [path, { filesystem, sandboxMount }] of Object.entries(mounts)) {
      this._mounts.set(path, {
        filesystem,
        sandboxMount,
        state: 'pending',
      });
    }
  }

  /**
   * Get all mount entries with their current state.
   */
  getMountEntries(): ReadonlyMap<string, MountEntry> {
    return this._mounts;
  }

  /**
   * Hash a mount config for comparison.
   * Used to detect if config has changed (credentials, bucket, etc.).
   */
  protected hashConfig(config: FilesystemMountConfig): string {
    // Create a stable JSON string and hash it
    const normalized = JSON.stringify(config, Object.keys(config).sort());
    return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  }

  /**
   * Mount all pending filesystems.
   * Called by subclasses after sandbox is ready (in start()).
   */
  protected async mountPending(): Promise<void> {
    for (const [path, mount] of this._mounts) {
      if (mount.state !== 'pending' || !mount.sandboxMount) {
        continue;
      }

      // Check if filesystem supports mounting
      if (!mount.filesystem.getMountConfig) {
        mount.state = 'unsupported';
        mount.error = 'Filesystem does not support mounting';
        continue;
      }

      // Get and store the mount config
      mount.config = mount.filesystem.getMountConfig();
      mount.configHash = this.hashConfig(mount.config);

      mount.state = 'mounting';

      try {
        const result = await this.mount?.(mount.filesystem, path);
        if (result?.success) {
          mount.state = 'mounted';
        } else {
          mount.state = 'error';
          mount.error = result?.error ?? 'Mount failed';
        }
      } catch (err) {
        mount.state = 'error';
        mount.error = String(err);
      }
    }
  }

  /**
   * Abstract mount method - implemented by subclasses.
   * BaseSandbox.mountPending() calls this for each pending mount.
   */
  abstract mount?(filesystem: WorkspaceFilesystem, mountPath: string): Promise<MountResult>;
}

// =============================================================================
// Core Types
// =============================================================================

export interface ExecutionResult {
  /** Whether execution completed successfully (exitCode === 0) */
  success: boolean;
  /** Exit code (0 = success) */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** Whether execution timed out */
  timedOut?: boolean;
  /** Whether execution was killed */
  killed?: boolean;
}

export interface CommandResult extends ExecutionResult {
  /** The command that was executed */
  command?: string;
  /** Arguments passed to the command */
  args?: string[];
}

// =============================================================================
// Execution Options
// =============================================================================

export interface ExecuteCommandOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Environment variables */
  env?: NodeJS.ProcessEnv;
  /** Working directory */
  cwd?: string;
  /** Callback for stdout chunks (enables streaming) */
  onStdout?: (data: string) => void;
  /** Callback for stderr chunks (enables streaming) */
  onStderr?: (data: string) => void;
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
 * Lifecycle methods (from Lifecycle interface) are all optional:
 * - init(): One-time setup (provision templates, install deps)
 * - start(): Begin operation (spin up instance)
 * - stop(): Pause operation (pause instance)
 * - destroy(): Clean up resources (terminate instance)
 * - isReady(): Check if ready for operations
 * - getInfo(): Get status and metadata
 */
export interface WorkspaceSandbox extends Lifecycle<SandboxInfo> {
  /** Unique identifier for this sandbox instance */
  readonly id: string;

  /** Human-readable name (e.g., 'E2B Sandbox', 'Docker') */
  readonly name: string;

  /** Provider type identifier */
  readonly provider: string;

  /**
   * Working directory for command execution (if applicable).
   * Not all sandbox implementations have a fixed working directory.
   */
  readonly workingDirectory?: string;

  /**
   * Get instructions describing how this sandbox works.
   * Used in tool descriptions to help agents understand execution context.
   *
   * @returns A string describing how to use this sandbox
   */
  getInstructions?(): string;

  // ---------------------------------------------------------------------------
  // Command Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute a shell command.
   * Optional - if not implemented, the workspace_execute_command tool won't be available.
   * @throws {SandboxExecutionError} if command fails to start
   * @throws {SandboxTimeoutError} if command times out
   */
  executeCommand?(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult>;

  // ---------------------------------------------------------------------------
  // Mounting Support (Optional)
  // ---------------------------------------------------------------------------

  /**
   * Set mounts that should be mounted into the sandbox.
   * Called by Workspace to inform sandbox of pending mounts.
   * Mounts will be processed when start() is called.
   *
   * @param mounts - Record of mount path to filesystem and options
   */
  setMounts?(mounts: Record<string, { filesystem: WorkspaceFilesystem; sandboxMount: boolean }>): void;

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

  /**
   * Get list of current mounts in the sandbox.
   *
   * @returns Array of mount information
   */
  getMounts?(): Promise<Array<{ path: string; filesystem: string }>>;
}

// =============================================================================
// Sandbox Info
// =============================================================================

export interface SandboxInfo {
  id: string;
  name: string;
  provider: string;
  status: ProviderStatus;
  /** When the sandbox was created */
  createdAt: Date;
  /** When the sandbox was last used */
  lastUsedAt?: Date;
  /** Time until auto-shutdown (if applicable) */
  timeoutAt?: Date;
  /** Current mounts in the sandbox */
  mounts?: Array<{ path: string; filesystem: string }>;
  /** Resource info (if available) */
  resources?: {
    memoryMB?: number;
    memoryUsedMB?: number;
    cpuCores?: number;
    cpuPercent?: number;
    diskMB?: number;
    diskUsedMB?: number;
  };
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Errors
// =============================================================================

export class SandboxError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'SandboxError';
  }
}

export class SandboxExecutionError extends SandboxError {
  constructor(
    message: string,
    public readonly exitCode: number,
    public readonly stdout: string,
    public readonly stderr: string,
  ) {
    super(message, 'EXECUTION_FAILED', { exitCode, stdout, stderr });
    this.name = 'SandboxExecutionError';
  }
}

/** Sandbox operation types for timeout errors */
export type SandboxOperation = 'command' | 'sync' | 'install';

export class SandboxTimeoutError extends SandboxError {
  constructor(
    public readonly timeoutMs: number,
    public readonly operation: SandboxOperation,
  ) {
    super(`Execution timed out after ${timeoutMs}ms`, 'TIMEOUT', { timeoutMs, operation });
    this.name = 'SandboxTimeoutError';
  }
}

export class SandboxNotReadyError extends SandboxError {
  constructor(idOrStatus: string) {
    super(`Sandbox is not ready: ${idOrStatus}`, 'NOT_READY', { id: idOrStatus });
    this.name = 'SandboxNotReadyError';
  }
}

export class IsolationUnavailableError extends SandboxError {
  constructor(
    public readonly backend: string,
    public readonly reason: string,
  ) {
    super(`Isolation backend '${backend}' is not available: ${reason}`, 'ISOLATION_UNAVAILABLE', { backend, reason });
    this.name = 'IsolationUnavailableError';
  }
}

// =============================================================================
// Mount Errors
// =============================================================================

/**
 * Base error for mount operations.
 */
export class MountError extends SandboxError {
  constructor(
    message: string,
    public readonly mountPath: string,
    details?: Record<string, unknown>,
  ) {
    super(message, 'MOUNT_ERROR', { mountPath, ...details });
    this.name = 'MountError';
  }
}

/**
 * Error thrown when sandbox doesn't support mounting.
 */
export class MountNotSupportedError extends SandboxError {
  constructor(sandboxProvider: string) {
    super(`Sandbox provider '${sandboxProvider}' does not support mounting`, 'MOUNT_NOT_SUPPORTED', {
      sandboxProvider,
    });
    this.name = 'MountNotSupportedError';
  }
}

/**
 * Error thrown when a filesystem cannot be mounted.
 */
export class FilesystemNotMountableError extends SandboxError {
  constructor(filesystemProvider: string, reason?: string) {
    const message = reason
      ? `Filesystem '${filesystemProvider}' cannot be mounted: ${reason}`
      : `Filesystem '${filesystemProvider}' does not support mounting`;
    super(message, 'FILESYSTEM_NOT_MOUNTABLE', { filesystemProvider, reason });
    this.name = 'FilesystemNotMountableError';
  }
}
