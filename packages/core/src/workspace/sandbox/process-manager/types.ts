/**
 * Process Manager Types
 *
 * Type definitions for background process management.
 */

// =============================================================================
// Spawn Options
// =============================================================================

export interface SpawnProcessOptions {
  /** Environment variables */
  env?: NodeJS.ProcessEnv;
  /** Working directory */
  cwd?: string;
  /** Callback for stdout data as it arrives */
  onStdout?: (data: string) => void;
  /** Callback for stderr data as it arrives */
  onStderr?: (data: string) => void;
}

// =============================================================================
// Process Info
// =============================================================================

/**
 * Info about a tracked background process.
 * Returned by {@link SandboxProcessManager.list}.
 */
export interface ProcessInfo {
  /** Process ID */
  pid: number;
  /** The command that was executed */
  command: string;
  /** Whether the process is still running */
  running: boolean;
  /** Exit code if the process has finished */
  exitCode?: number;
}
