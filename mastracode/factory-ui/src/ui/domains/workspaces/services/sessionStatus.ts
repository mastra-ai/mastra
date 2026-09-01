import type { SessionRowStatus } from '../components/SessionActivity';

/**
 * The one precedence every session surface reads: an active run means work is
 * happening even before the workspace record is stamped materialized, and an
 * attention mark only speaks once nothing louder does. `undefined` is a session
 * with nothing to report — rows hide their belt, cards fall back to `idle`.
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
