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
  /**
   * Who started the process. The process manager stores it on the handle and
   * returns it from `list()` and `get()`, so hosts can show or scope processes
   * by thread or resource. Providers ignore it.
   */
  metadata?: ProcessMetadata;
}

/** Who started a process and when. */
export interface ProcessMetadata {
  /** Memory thread of the run that started the process. */
  threadId?: string;
  /** Memory resource of the run that started the process. */
  resourceId?: string;
  /** Tool call that started the process. */
  toolCallId?: string;
  /** When the process was spawned, in milliseconds since the epoch. The process manager fills it in when omitted. */
  startedAt?: number;
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
  /** Who started the process, when it was spawned with `metadata` (as `execute_command` does) */
  metadata?: ProcessMetadata;
}
