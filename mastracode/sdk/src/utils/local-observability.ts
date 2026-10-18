import type { PruneResult, RetentionConfig } from '@mastra/core/storage';
import { DuckDBStore } from '@mastra/duckdb';

/**
 * Age limits for the local trace store, matching `DEFAULT_RETENTION` for the
 * libsql store (14 days of telemetry, 30 days of scores).
 */
export const LOCAL_OBSERVABILITY_RETENTION: RetentionConfig = {
  observability: {
    spans: { maxAge: '14d' },
    metrics: { maxAge: '14d' },
    logs: { maxAge: '14d' },
    scores: { maxAge: '30d' },
    feedback: { maxAge: '30d' },
  },
};

/** Upper bound on rows deleted per table per session, so startup pruning never runs long. */
const MAX_ROWS_PER_OPEN = 50_000;

/**
 * Open the local observability DuckDB file used when `/observability local on`.
 * Connects eagerly so a lock error surfaces now, not mid-session, then prunes
 * aged events in the background so the file cannot grow without bound.
 * `pruned` never rejects; anything left over is pruned on the next open.
 */
export async function openLocalObservabilityStore(
  path: string,
): Promise<{ store: DuckDBStore; pruned: Promise<PruneResult[]> }> {
  const store = new DuckDBStore({ id: 'mastra-code-observability', path, retention: LOCAL_OBSERVABILITY_RETENTION });
  await store.db.getConnection();
  // No init() here: the session composite initializes the domain, and a fresh
  // file has nothing to prune (the missing-table error is swallowed below).
  const pruned = store.prune({ maxRows: MAX_ROWS_PER_OPEN, pauseMs: 10 }).catch(() => []);
  return { store, pruned };
}
