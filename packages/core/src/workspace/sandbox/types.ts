/**
 * Sandbox Types
 *
 * Type definitions for sandbox state, execution results, and configuration.
 */

import type { WorkspaceFilesystem } from '../filesystem/filesystem';
import type { FilesystemMountConfig } from '../filesystem/mount';
import type { ProviderStatus } from '../lifecycle';

// =============================================================================
// Mount State Types
// =============================================================================

/**
 * State of a mount in the sandbox.
 */
export type MountState = 'pending' | 'mounting' | 'mounted' | 'error' | 'unsupported' | 'unavailable';

/**
 * Entry representing a mount in the sandbox.
 */
export interface MountEntry {
  /** The filesystem to mount */
  filesystem: WorkspaceFilesystem;
  /** Current state of the mount */
  state: MountState;
  /** Error message if state is 'error' or 'unavailable' */
  error?: string;
  /** Resolved mount config from filesystem.getMountConfig() */
  config?: FilesystemMountConfig;
  /** Hash of config for quick comparison */
  configHash?: string;
}

// =============================================================================
// Execution Types
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
  /** Whether stdout dropped older output due to a retention limit */
  stdoutTruncated?: boolean;
  /** Whether stderr dropped older output due to a retention limit */
  stderrTruncated?: boolean;
  /** Number of stdout bytes dropped due to a retention limit */
  stdoutDroppedBytes?: number;
  /** Number of stderr bytes dropped due to a retention limit */
  stderrDroppedBytes?: number;
}

export interface CommandResult extends ExecutionResult {
  /** The command that was executed */
  command?: string;
  /** Arguments passed to the command */
  args?: string[];
}

// =============================================================================
// Command Options
// =============================================================================

/**
 * Shared options for running commands in a sandbox.
 * Base type for both executeCommand and spawn.
 */
export interface CommandOptions {
  /** Timeout in milliseconds. Kills the process if exceeded. */
  timeout?: number;
  /** Environment variables */
  env?: NodeJS.ProcessEnv;
  /** Working directory */
  cwd?: string;
  /** Callback for stdout chunks (enables streaming) */
  onStdout?: (data: string) => void;
  /** Callback for stderr chunks (enables streaming) */
  onStderr?: (data: string) => void;
  /** Abort signal to cancel the command */
  abortSignal?: AbortSignal;
  /**
   * Maximum UTF-8 byte length retained in stdout and stderr per stream.
   * When exceeded, the oldest output is dropped and the newest output is kept.
   * Callbacks and reader streams still receive every chunk in full.
   * Use 0 to disable retention, a positive integer to set a byte limit,
   * or Infinity to retain all output.
   *
   * Defaults to 1048576 for spawned processes. The built-in executeCommand
   * implementation retains all output unless this option is set.
   */
  maxRetainedBytes?: number;
}

/** Options for executeCommand. */
export interface ExecuteCommandOptions extends CommandOptions {}

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
// Error Types
// =============================================================================

/** Sandbox operation types for timeout errors */
export type SandboxOperation = 'command' | 'sync' | 'install';
