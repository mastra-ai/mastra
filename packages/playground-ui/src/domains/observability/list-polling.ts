import { MastraClientError } from '@mastra/client-js';

/** How often a list that cannot merge changes reloads in place, or retries a transient failure. */
export const OBSERVABILITY_LIST_REFETCH_INTERVAL_MS = 10_000;
/** Polls that only ask for what changed (delta or head polls) are cheap, so they share a slower cadence. */
export const OBSERVABILITY_LIST_POLL_INTERVAL_MS = 30_000;
/** How far past the anchor a delta-polled rolling window reaches, so rows started after mount still match. */
export const OBSERVABILITY_LIST_HORIZON_MS = 24 * 60 * 60 * 1000;
/** Rows asked for by one head poll. */
export const OBSERVABILITY_LIST_HEAD_LIMIT = 50;
/** Head rows kept across polls before the list reloads its first page instead. */
export const OBSERVABILITY_LIST_HEAD_MAX_ROWS = 500;

/** The server refused the request (e.g. a time range over its cap); retrying cannot change that. */
export function isRejectedListRequest(error: unknown): boolean {
  return error instanceof MastraClientError && error.status >= 400 && error.status < 500;
}

export function fixedWindowRefetchInterval(error: unknown): number | false {
  return isRejectedListRequest(error) ? false : OBSERVABILITY_LIST_REFETCH_INTERVAL_MS;
}

/**
 * For an infinite list that must not reload its pages on a timer: it only reloads to recover from a
 * transient failure. Delta or head polls bring the new rows instead.
 */
export function recoveryRefetchInterval(error: unknown): number | false {
  return error && !isRejectedListRequest(error) ? OBSERVABILITY_LIST_REFETCH_INTERVAL_MS : false;
}
