import type { PruneResult, RetentionConfig } from '@mastra/core/storage';
import { DuckDBStore } from '@mastra/duckdb';

/**
 * Age limits for the local trace store: 14 days for spans, metrics and logs,
 * 30 days for scores and feedback. Spans, logs and scores use the same windows
 * as libsql's `DEFAULT_RETENTION`, which has no metrics or feedback entries.
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

const OBSERVABILITY_TABLES = ['span_events', 'metric_events', 'log_events', 'score_events', 'feedback_events'];

/**
 * Prune only when every observability table already exists. A brand-new file
 * has no tables until the session composite runs init(), and pruning it would
 * log a missing-table error from the storage layer for a file with nothing to delete.
 */
async function pruneExistingTables(store: DuckDBStore): Promise<PruneResult[]> {
  const existing = await store.db.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_name IN (${OBSERVABILITY_TABLES.map(() => '?').join(', ')})`,
    OBSERVABILITY_TABLES,
  );
  if (existing.length < OBSERVABILITY_TABLES.length) return [];
  return store.prune({ maxRows: MAX_ROWS_PER_OPEN, pauseMs: 10 });
}

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
  // No init() here: the session composite initializes the domain.
  const pruned = pruneExistingTables(store).catch(() => []);
  return { store, pruned };
}
