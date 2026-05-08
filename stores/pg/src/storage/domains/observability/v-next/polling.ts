/**
 * Delta-polling helpers for the v-next Postgres observability domain.
 *
 * Cursor model
 * ------------
 * Each signal table (mastra_span_events, mastra_metric_events,
 * mastra_log_events, mastra_score_events, mastra_feedback_events) has a
 * `cursorId bigserial` column. Postgres draws the next value from a sequence
 * owned by the parent table on each insert — on partitioned tables the
 * sequence is shared across partitions, and on a TimescaleDB hypertable it
 * works the same way. The cursor is monotonically increasing in insert order.
 *
 * Concurrency caveat (matches the DuckDB adapter)
 * -----------------------------------------------
 * `bigserial` increments are non-transactional, so a row with a higher
 * `cursorId` can become visible to readers *before* a row with a lower
 * `cursorId` whose transaction is still in flight. A naive
 * `cursorId > $after ORDER BY cursorId` then skips the late-committer
 * forever. For the low-volume target this adapter is built for this is
 * effectively zero risk, but if it ever shows up in practice the fix is to
 * advance the cursor only up to a "safe horizon" — the max `cursorId` whose
 * backing transaction is guaranteed committed.
 *
 * TODO(observability): When concurrent-writer skips become a real issue,
 * cap the emitted cursor at the safe horizon. Postgres exposes that via
 * `pg_snapshot_xmin(pg_current_snapshot())` (the oldest still-in-progress
 * xact id at the time of the snapshot) — rows from older xacts are
 * guaranteed visible. The shape would be something like:
 *
 *   WITH horizon AS (
 *     SELECT max("cursorId") AS cursor_id
 *     FROM mastra_log_events
 *     WHERE xmin::text::bigint < pg_snapshot_xmin(pg_current_snapshot())::text::bigint
 *   )
 *   SELECT … WHERE "cursorId" <= (SELECT cursor_id FROM horizon)
 *
 * That keeps the cursor strictly behind in-flight writes at the cost of one
 * extra subquery per poll.
 */

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { coreFeatures } from '@mastra/core/features';

export const OBSERVABILITY_DELTA_POLLING_FEATURE = 'observability-delta-polling';

export function deltaPollingFeatureEnabled(): boolean {
  return coreFeatures.has(OBSERVABILITY_DELTA_POLLING_FEATURE);
}

export function assertDeltaPollingEnabled(): void {
  if (deltaPollingFeatureEnabled()) return;
  throw new MastraError({
    id: 'OBSERVABILITY_DELTA_POLLING_NOT_SUPPORTED',
    domain: ErrorDomain.MASTRA_OBSERVABILITY,
    category: ErrorCategory.SYSTEM,
    text: 'This storage provider does not support observability delta polling',
  });
}

/**
 * Coerce a cursor value into the opaque string form the public API expects.
 *
 * Returns `"0"` for a null/undefined input (e.g. `MAX("cursorId")` on an
 * empty table). Callers treat `"0"` as "start of stream" — passing it back
 * as `after` matches every row since `bigserial` starts at 1. There's
 * therefore no way to distinguish "empty table" from "explicit bootstrap"
 * by inspecting the cursor alone; if that matters, check `delta.hasMore`.
 */
export function encodeDeltaCursor(value: unknown): string {
  return String(value ?? 0);
}

/**
 * Postgres `bigint` upper bound (2^63 - 1). The cursor goes into a
 * `$N::bigint` cast server-side; values above this overflow and fail with
 * "value out of range" before the query even runs.
 */
const PG_BIGINT_MAX = 9223372036854775807n;

/** Reject anything other than a non-negative integer cursor fitting in a Postgres bigint. */
export function validateCursorId(cursor: string): string {
  if (!/^\d+$/.test(cursor)) {
    throw new MastraError({
      id: 'OBSERVABILITY_INVALID_DELTA_CURSOR',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.USER,
      text: 'Invalid observability delta cursor',
    });
  }
  let value: bigint;
  try {
    value = BigInt(cursor);
  } catch {
    throw new MastraError({
      id: 'OBSERVABILITY_INVALID_DELTA_CURSOR',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.USER,
      text: 'Invalid observability delta cursor',
    });
  }
  if (value < 0n || value > PG_BIGINT_MAX) {
    throw new MastraError({
      id: 'OBSERVABILITY_INVALID_DELTA_CURSOR',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.USER,
      text: 'Invalid observability delta cursor',
    });
  }
  return cursor;
}
