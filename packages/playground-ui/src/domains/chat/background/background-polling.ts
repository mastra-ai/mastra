import type { QueryStatus } from '@tanstack/react-query';

/** How often background work that is still running is read again. */
export const BACKGROUND_POLL_MS = 2_000;

/** Read again while the work runs; a failed read (a 404, say) is not retried by polling. */
export const pollWhileRunning = (status: QueryStatus, running: boolean): number | false =>
  status !== 'error' && running ? BACKGROUND_POLL_MS : false;
