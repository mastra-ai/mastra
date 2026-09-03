/**
 * Session lifecycle states a marker can surface. The colour scheme mirrors
 * `SessionFavicon`, so the sidebar and the tab favicon read the same way.
 */
export type SessionRowStatus = 'initializing' | 'working' | 'ready';

/**
 * The one precedence every session surface reads: an active run means work is
 * happening even before the workspace record is stamped materialized, and a
 * card waiting on a person only speaks once nothing louder does. `undefined` is
 * an idle session, which runs no marker at all.
 */
export function sessionRowStatus(input: {
  running: boolean;
  initializing: boolean;
  attention?: boolean;
}): SessionRowStatus | undefined {
  if (input.running) return 'working';
  if (input.initializing) return 'initializing';
  if (input.attention) return 'ready';
  return undefined;
}

/** What the open chat's surfaces (favicon, composer, status line) report. */
export type ChatSessionPhase = 'initializing' | 'working' | 'awaiting' | 'error';

/**
 * The in-chat counterpart of `sessionRowStatus`, sharing its law that a live
 * run outranks initialization. An optimistic pending send ranks below it: until
 * the thread exists and loads, an echo is hope, not work.
 */
export function chatSessionPhase(input: {
  sessionError: boolean;
  threadError: boolean;
  hasThread: boolean;
  running: boolean;
  initializing: boolean;
  pending: boolean;
}): ChatSessionPhase | undefined {
  if (input.sessionError) return 'error';
  if (input.running) return 'working';
  if (input.initializing) return 'initializing';
  if (!input.hasThread) return undefined;
  if (input.threadError) return 'error';
  if (input.pending) return 'working';
  return 'awaiting';
}
