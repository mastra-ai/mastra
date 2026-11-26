/**
 * Session lifecycle states a marker can surface. The colour scheme mirrors
 * `SessionFavicon`, so the sidebar and the tab favicon read the same way.
 */
export type SessionRowStatus = 'initializing' | 'working' | 'ready';

/**
 * The one precedence every session surface reads. A run parked on a person cannot be setting its sandbox up,
 * so attention outranks initializing. A sandbox still coming up is the slow, fallible step, so it outranks the
 * run already kicked off on it. `undefined` runs no marker.
 */
export function sessionRowStatus(input: {
  running: boolean;
  initializing: boolean;
  attention?: boolean;
}): SessionRowStatus | undefined {
  if (input.attention) return 'ready';
  if (input.initializing) return 'initializing';
  if (input.running) return 'working';
  return undefined;
}
