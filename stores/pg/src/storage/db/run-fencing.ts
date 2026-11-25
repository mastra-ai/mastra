import type { RunFence } from '@mastra/core/storage';
import { matchesRunFence, RunFenceConflictError } from '@mastra/core/storage';
import type { DbClient, TxClient } from '../client';

/** The query methods both the pool client and a transaction client offer. */
export type Queryable = Omit<TxClient, 'batch'>;

/**
 * Epoch milliseconds on the database clock. `clock_timestamp()` rather than
 * `now()`: a statement can wait on a row lock, and lease math must use the
 * time it actually runs, not when its transaction started.
 */
export const DB_NOW_MS = `(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint`;

/**
 * The check half of a fenced write; call it first inside the write's
 * transaction. `FOR SHARE` holds the claim row until commit, so a claim that
 * updates the row waits for the write to finish, and every later write sees
 * the new claim.
 */
export async function assertRunFence(
  t: Queryable,
  claimsTable: string,
  fence: RunFence,
  operation: string,
): Promise<void> {
  // `generation` is BIGINT, which comes back as a string.
  const row = await t.oneOrNone<{ generation: string | number; ownerId: string }>(
    `SELECT generation, "ownerId" FROM ${claimsTable} WHERE "runId" = $1 FOR SHARE`,
    [fence.runId],
  );
  const current = row && { generation: Number(row.generation), ownerId: row.ownerId };
  if (!matchesRunFence(current, fence)) {
    throw new RunFenceConflictError(fence, operation);
  }
}

/**
 * The `claim` CTE of a single-statement fenced write: one row while `fence`,
 * bound at `$first` (runId), `$first + 1` (generation) and `$first + 2`
 * (ownerId), is the run's current claim. Gate the write on
 * `EXISTS (SELECT 1 FROM claim)` and end the statement with
 * {@link fencedResultSql}. The lock lasts only as long as the statement, so a
 * client cut mid-write never leaves the claim row locked: a concurrent claim
 * either commits first, and the recheck after the wait finds no row, or waits
 * for this one statement.
 */
export function runFenceCte(claimsTable: string, first: number): string {
  return `claim AS (
    SELECT 1 FROM ${claimsTable}
    WHERE "runId" = $${first} AND generation = $${first + 1}::bigint AND "ownerId" = $${first + 2}
    FOR SHARE
  )`;
}

/** The values {@link runFenceCte} binds, in order. */
export function runFenceParams(fence: RunFence): unknown[] {
  return [fence.runId, fence.generation, fence.ownerId];
}

/**
 * The final SELECT of a single-statement fenced write: always one row, with
 * `fenced`, `written` (whether the CTE `cte` returned a row) and `columns` of
 * that row, if any.
 */
export function fencedResultSql(cte: string, columns = `${cte}.*`): string {
  return `SELECT EXISTS (SELECT 1 FROM claim) AS fenced, EXISTS (SELECT 1 FROM ${cte}) AS written${columns ? `, ${columns}` : ''}
    FROM (SELECT 1) AS one LEFT JOIN ${cte} ON true`;
}

/**
 * Runs a statement built with {@link runFenceCte} and {@link fencedResultSql}.
 * Returns the written row, or null when the write's own conditions left it
 * unwritten, as `oneOrNone` does for the unfenced statement.
 */
export async function runFencedStatement<T>(
  q: Queryable,
  fence: RunFence,
  operation: string,
  sql: string,
  values: unknown[],
): Promise<T | null> {
  const { fenced, written, ...row } = await q.one<{ fenced: boolean; written: boolean }>(sql, values);
  if (!fenced) throw new RunFenceConflictError(fence, operation);
  return written ? (row as T) : null;
}

/**
 * `serialize()` for a single-statement fenced write, whose values are
 * serialized before the statement checks the fence. When serializing throws
 * and `fence` is not the run's current claim, throws
 * {@link RunFenceConflictError} instead, as when the fence was checked first.
 */
export async function serializeFenced<T>(
  q: Queryable,
  claimsTable: string,
  fence: RunFence | undefined,
  operation: string,
  serialize: () => T,
): Promise<T> {
  try {
    return serialize();
  } catch (error) {
    if (fence) await assertRunFence(q, claimsTable, fence, operation);
    throw error;
  }
}

/**
 * Runs `write` directly when it carries no fence, or in a transaction behind
 * the fence check when it does.
 */
export function withRunFence<T>(
  client: DbClient,
  claimsTable: string,
  fence: RunFence | undefined,
  operation: string,
  write: (q: Queryable) => Promise<T>,
): Promise<T> {
  if (!fence) return write(client);
  return client.tx(async t => {
    await assertRunFence(t, claimsTable, fence, operation);
    return write(t);
  });
}
