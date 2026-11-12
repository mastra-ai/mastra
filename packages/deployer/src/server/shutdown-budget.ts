/** How long the server drains in-flight requests, and then in-flight workflow runs, by default. */
export const DEFAULT_SERVER_DRAIN_TIMEOUT_MS = 5000;

/**
 * How long core teardown gets on top of the drain window: up to 1.5s to hand back agent thread
 * runs, then cleanup that must always run (e.g. DuckDB's file lock release).
 */
export const CORE_SHUTDOWN_TIMEOUT_MS = 6500;

/**
 * The longest a server takes to exit after a shutdown signal: the HTTP drain, then `mastra.shutdown()`
 * with the same drain window plus core teardown. A supervisor that kills the server sooner can cut
 * off the teardown, such as the end of the liveness of the evented runs it drove. A drain window the server
 * would reject counts as the default; the result is capped at the longest timer delay.
 */
export function serverShutdownBudgetMs(drainTimeoutMs?: number): number {
  const drain =
    typeof drainTimeoutMs === 'number' && Number.isFinite(drainTimeoutMs) && drainTimeoutMs >= 0
      ? drainTimeoutMs
      : DEFAULT_SERVER_DRAIN_TIMEOUT_MS;
  return Math.min(2 * drain + CORE_SHUTDOWN_TIMEOUT_MS, 2 ** 31 - 1);
}
