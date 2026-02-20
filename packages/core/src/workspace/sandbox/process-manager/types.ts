/**
 * Process Manager Types
 *
 * Type definitions for background process management.
 */

import type { CommandOptions } from '../types';

// =============================================================================
// Spawn Options
// =============================================================================

/** Options for spawning a background process. */
export interface SpawnProcessOptions extends CommandOptions {}

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
