/**
 * Session lifecycle states a marker can surface. The colour scheme mirrors
 * `SessionFavicon`, so the sidebar and the tab favicon read the same way.
 */
export type SessionRowStatus = 'initializing' | 'working' | 'ready';

/**
 * The one precedence every session surface reads: an active run means work is
 * happening even before the workspace record is stamped materialized, and an
 * attention mark only speaks once nothing louder does. `undefined` is a session
 * with nothing to report, which runs no marker at all.
 */
export function sessionRowStatus(input: {
  running: boolean;
  initializing: boolean;
  attention: boolean;
}): SessionRowStatus | undefined {
  if (input.running) return 'working';
  if (input.initializing) return 'initializing';
  if (input.attention) return 'ready';
  return undefined;
}
