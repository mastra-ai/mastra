/**
 * Delta-polling helpers for the v-next Postgres observability domain.
 *
 * Cursor model
 * ------------
 * Each signal table stores both:
 *   - `xactId xid8 DEFAULT pg_current_xact_id()`
 *   - `cursorId bigserial`
 *
 * `bigserial` values are allocated before commit, so a later `cursorId` can
 * become visible before an earlier one. Delta reads therefore order by the
 * pair `(xactId, cursorId)` and cap reads at PostgreSQL's safe transaction
 * horizon: `pg_snapshot_xmin(pg_current_snapshot())`. Rows with `xactId`
 * below that horizon cannot still be in flight, so advancing the cursor there
 * cannot skip a late-committing row.
 */

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { coreFeatures } from '@mastra/core/features';
import type { DbClient } from '../../../client';

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
 * Postgres `bigint` upper bound (2^63 - 1). The cursor goes into a
 * `$N::bigint` cast server-side; values above this overflow and fail with
 * "value out of range" before the query even runs.
 */
const PG_BIGINT_MAX = 9223372036854775807n;

export interface DeltaCursorParts {
  xactId: string;
  cursorId: string;
}

function invalidDeltaCursor(): never {
  throw new MastraError({
    id: 'OBSERVABILITY_INVALID_DELTA_CURSOR',
    domain: ErrorDomain.MASTRA_OBSERVABILITY,
    category: ErrorCategory.USER,
    text: 'Invalid observability delta cursor',
  });
}

function validatePgInteger(value: string): string {
  if (!/^\d+$/.test(value)) {
    invalidDeltaCursor();
  }
  let parsed: bigint;
  try {
    parsed = BigInt(value);
  } catch {
    invalidDeltaCursor();
  }
  if (parsed < 0n || parsed > PG_BIGINT_MAX) {
    invalidDeltaCursor();
  }
  return value;
}

export function encodeDeltaCursor(xactId: unknown, cursorId: unknown = 0): string {
  return `${validatePgInteger(String(xactId ?? 0))}:${validatePgInteger(String(cursorId ?? 0))}`;
}

export function decodeDeltaCursor(cursor: string): DeltaCursorParts {
  const parts = cursor.split(':');
  if (parts.length !== 2) {
    invalidDeltaCursor();
  }
  return {
    xactId: validatePgInteger(parts[0]!),
    cursorId: validatePgInteger(parts[1]!),
  };
}

export async function readSafeXactHorizon(client: DbClient): Promise<string> {
  const row = await client.one<{ xactId: string }>(`SELECT pg_snapshot_xmin(pg_current_snapshot())::text AS "xactId"`);
  return validatePgInteger(row.xactId);
}
