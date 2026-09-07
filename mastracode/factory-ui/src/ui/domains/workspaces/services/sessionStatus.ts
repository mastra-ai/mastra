/**
 * Session lifecycle states a marker can surface. The colour scheme mirrors
 * `SessionFavicon`, so the sidebar and the tab favicon read the same way.
 */
export type SessionRowStatus = 'initializing' | 'working' | 'ready';

/**
 * The one precedence every session surface reads. A sandbox still coming up is the slow, fallible step,
 * so it outranks the run already kicked off on it; attention speaks last. `undefined` runs no marker.
 */
export function sessionRowStatus(input: {
  running: boolean;
  initializing: boolean;
  attention?: boolean;
}): SessionRowStatus | undefined {
  if (input.initializing) return 'initializing';
  if (input.running) return 'working';
  if (input.attention) return 'ready';
  return undefined;
}

/** What the open chat's surfaces (favicon, composer, status line) report. */
export type ChatSessionPhase = 'initializing' | 'working' | 'awaiting' | 'error';

/**
 * The in-chat counterpart of `sessionRowStatus`, except a live run outranks initialization here:
 * `initializing` locks the composer, and whoever watches the stream must stay able to steer it.
 * A pending send ranks below both: until the thread exists and loads, an echo is hope, not work.
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
