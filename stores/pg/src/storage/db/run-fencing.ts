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
  const current = await t.oneOrNone<{ generation: number; ownerId: string }>(
    `SELECT generation, "ownerId" FROM ${claimsTable} WHERE "runId" = $1 FOR SHARE`,
    [fence.runId],
  );
  if (!matchesRunFence(current, fence)) {
    throw new RunFenceConflictError(fence, operation);
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
