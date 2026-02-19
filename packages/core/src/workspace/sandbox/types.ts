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
// Spawn Options
// =============================================================================

export interface SpawnProcessOptions {
  /** Environment variables */
  env?: NodeJS.ProcessEnv;
  /** Working directory */
  cwd?: string;
}

// =============================================================================
// Background Process Types
// =============================================================================

/**
 * Handle to a spawned background process.
 * Returned by {@link SandboxProcessManager.spawn}.
 * Provides methods to interact with a running background process.
 */
export interface ProcessHandle {
  /** Process ID of the running command */
  readonly pid: number;
  /** The command that was executed */
  readonly command: string;
  /** Arguments passed to the command */
  readonly args: string[];
  /** Whether the process is still running */
  readonly running: boolean;
  /** Accumulated stdout so far */
  readonly stdout: string;
  /** Accumulated stderr so far */
  readonly stderr: string;
  /** Exit code, undefined while the process is still running */
  readonly exitCode: number | undefined;
  /** Wait for the command to finish and return the result */
  wait(): Promise<CommandResult>;
  /** Kill the running command (SIGKILL). Returns true if killed, false if not found. */
  kill(): Promise<boolean>;
  /** Send data to the command's stdin */
  sendStdin(data: string): Promise<void>;
}

/**
 * Info about a tracked background process.
 * Returned by {@link SandboxProcessManager.list}.
 */
export interface ProcessInfo {
  /** Process ID */
  pid: number;
  /** The command that was executed */
  command: string;
  /** Arguments passed to the command */
  args: string[];
  /** Whether the process is still running */
  running: boolean;
  /** Exit code if the process has finished */
  exitCode?: number;
  /** Accumulated stdout */
  stdout: string;
  /** Accumulated stderr */
  stderr: string;
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
// Error Types
// =============================================================================

/** Sandbox operation types for timeout errors */
export type SandboxOperation = 'command' | 'sync' | 'install';
