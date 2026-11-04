import type { RunFence } from '@mastra/core/storage';
import { matchesRunFence, RunFenceConflictError } from '@mastra/core/storage';
import type { SqlCondition, SqlQueryOptions } from '../sql-builder';
import type { DODB } from './index';

/** A write's fence, and the table holding the run's current claim to check it against. */
export interface RunFenceCheck {
  claimsTable: string;
  fence: RunFence;
  operation: string;
}

/**
 * Epoch milliseconds on the database clock. `julianday('now')` rather than
 * `unixepoch('subsec')`, which needs SQLite 3.42.
 */
export const DB_NOW_MS = `CAST(ROUND((julianday('now') - 2440587.5) * 86400000) AS INTEGER)`;

/**
 * The condition a fenced statement writes under: the check's fence is the
 * run's current claim. A Durable Object serves other requests whenever it
 * awaits I/O, so a fenced write can't check the claim first and write later; each of its statements carries this condition instead, and
 * SQLite evaluates it atomically with the write.
 */
export function runFenceGuard(check: RunFenceCheck | undefined): SqlCondition | undefined {
  if (!check) return undefined;
  const { claimsTable, fence } = check;
  return {
    sql: `EXISTS (SELECT 1 FROM ${claimsTable} AS run_fence WHERE run_fence.runId = ? AND run_fence.generation = ? AND run_fence.ownerId = ?)`,
    params: [fence.runId, fence.generation, fence.ownerId],
  };
}

/** Throws `RunFenceConflictError` unless the check's fence is the run's current claim. */
export async function assertRunFence(db: DODB, { claimsTable, fence, operation }: RunFenceCheck): Promise<void> {
  const row = (await db.executeQuery({
    sql: `SELECT generation, ownerId FROM ${claimsTable} WHERE runId = ?`,
    params: [fence.runId],
    first: true,
  })) as Record<string, unknown> | null;
  const current = row ? { generation: Number(row.generation), ownerId: String(row.ownerId) } : null;
  if (!matchesRunFence(current, fence)) {
    throw new RunFenceConflictError(fence, operation);
  }
}

/**
 * Runs one statement of a fenced write. With a check, `statement` must carry
 * `runFenceGuard(check)`. A guarded statement that changes no row either
 * found no target or was refused by its guard; re-reading the claim tells
 * which, and a refusal throws `RunFenceConflictError`.
 *
 * A write made of several statements stops at the first refused one, so a
 * takeover that lands between them leaves the earlier statements applied.
 * None of the refused writer's statements land after the takeover.
 */
export async function executeFenced(
  db: DODB,
  check: RunFenceCheck | undefined,
  { sql, params }: SqlQueryOptions,
): Promise<void> {
  if (!check) {
    await db.executeQuery({ sql, params });
    return;
  }
  const rows = await db.executeQuery({ sql: `${sql} RETURNING 1 AS written`, params });
  if (Array.isArray(rows) && rows.length === 0) {
    await assertRunFence(db, check);
  }
}
