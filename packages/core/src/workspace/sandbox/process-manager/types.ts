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
export interface SpawnProcessOptions extends CommandOptions {
  /** @internal Original argv before shell quoting; providers may ignore this hint. */
  originalInvocation?: { command: string; args: string[] };
  /**
   * How the child's stdin is wired.
   *
   * - `pipe` (default): stdin is a writable pipe, so {@link ProcessHandle.sendStdin}
   *   and {@link ProcessHandle.writer} can feed the process. Required for
   *   bidirectional protocols (LSP, JSON-RPC).
   * - `ignore`: stdin is closed at spawn. The child observes immediate EOF, so a
   *   command that reads stdin (a bare `rg`/`grep`/`cat` with no path argument,
   *   `read`) exits instead of blocking forever waiting for input that the
   *   sandbox never sends.
   *
   * Commands run to completion with output collected — `executeCommand` and
   * background spawns — use `ignore`. `sendStdin`/`closeStdin` throw on an
   * `ignore` process because there is no stdin to write to.
   *
   * Honored by the local, Docker, and E2B providers. Other providers may not
   * expose stdin control; on those, `stdinMode` is accepted but has no effect.
   */
  stdinMode?: 'pipe' | 'ignore';
}

// =============================================================================
// Process Info
// =============================================================================

/**
 * Info about a tracked process.
 * Returned by {@link SandboxProcessManager.list}.
 */
export interface ProcessInfo {
  /** Process ID */
  pid: string;
  /** The command that was executed (if available) */
  command?: string;
  /** Whether the process is still running */
  running: boolean;
  /** Exit code if the process has finished */
  exitCode?: number;
}
