/**
 * Maximum time to retain a running tool's result after caller cancellation.
 * Review probes measured two competing bounds, not a rationale for choosing 250 ms:
 * - A tool unwinding for 120 ms kept its result with a 150 ms window, but got a notice at 100 ms.
 * - With totalMs: 300, an uncooperative tool recorded a notice at 250 ms; a 1000 ms window
 *   lost to MastraTimeoutError before recording one (in-process engine only).
 * Cleanup needs time to finish, but the remaining run budget can pre-empt this window.
 */
export const TOOL_ABORT_GRACE_MS = 250;

export const TOOL_ABORT_NOTICE =
  'Tool execution was aborted while running. The tool may still be running and its effects are unknown. Check its status before retrying.';
