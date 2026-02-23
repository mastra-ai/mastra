/**
 * Process Manager Types
 *
 * Type definitions for process management.
 */

import type { CommandOptions } from '../types';

// =============================================================================
// Spawn Options
// =============================================================================

/** Options for spawning a process. */
export interface SpawnProcessOptions extends CommandOptions {}

// =============================================================================
// Process Info
// =============================================================================

/**
 * Info about a tracked process.
 * Returned by {@link SandboxProcessManager.list}.
 */
export interface ProcessInfo {
  /** Process ID */
  pid: number;
  /** The command that was executed (if available) */
  command?: string;
  /** Whether the process is still running */
  running: boolean;
  /** Exit code if the process has finished */
  exitCode?: number;
}
