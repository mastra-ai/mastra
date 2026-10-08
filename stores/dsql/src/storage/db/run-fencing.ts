import type { RunFence } from '@mastra/core/storage';
import { matchesRunFence, RunFenceConflictError } from '@mastra/core/storage';
import { getErrorCode, isRetriableError } from '../../shared/retry';
import type { DbClient, TxClient } from '../client';

/** The query methods both the pool client and a transaction client offer. */
export type Queryable = Omit<TxClient, 'batch'>;

/**
 * Epoch milliseconds on the database clock. Aurora DSQL never waits on a row
 * lock, so the transaction's start time is the time its statements run, and
 * every retry starts a new transaction with a fresh clock.
 */
export const DB_NOW_MS = `(EXTRACT(EPOCH FROM now()) * 1000)::bigint`;

/**
 * Retry predicate for writes to an ownership or fence row that may not exist
 * yet. Two first writers both insert the same key; the loser normally fails
 * at commit with an OCC conflict (40001), but a duplicate-key error (23505)
 * means the same thing here: the retry sees the row and takes the update path.
 */
export function isRetriableRunFenceWrite(error: unknown): boolean {
  return isRetriableError(error) || getErrorCode(error) === '23505';
}

/**
 * The check half of a fenced write; call it first inside the write's
 * transaction. Aurora DSQL has no blocking row locks: `FOR UPDATE` puts the
 * claim row in this transaction's write set instead, so a claim that commits
 * against the row while the write is in flight makes the write fail at commit
 * with an OCC conflict. The retry then sees the new claim and is rejected.
 */
export async function assertRunFence(
  t: Queryable,
  claimsTable: string,
  fence: RunFence,
  operation: string,
): Promise<void> {
  const current = await t.oneOrNone<{ generation: number; ownerId: string }>(
    `SELECT generation, "ownerId" FROM ${claimsTable} WHERE "runId" = $1 FOR UPDATE`,
    [fence.runId],
  );
  if (!matchesRunFence(current, fence)) {
    throw new RunFenceConflictError(fence, operation);
  }
}

/**
 * Runs `write` directly when it carries no fence, or in a transaction behind
 * the fence check when it does. Callers own retries: wrap the call in
 * `withRetry` so an OCC conflict re-runs the check as well as the write.
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
