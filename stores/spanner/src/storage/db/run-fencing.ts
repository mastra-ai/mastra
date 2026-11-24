import type { Transaction } from '@google-cloud/spanner';
import type { RunFence } from '@mastra/core/storage';
import { matchesRunFence, RunFenceConflictError } from '@mastra/core/storage';
import { quoteIdent } from './utils';
import type { SpannerDB } from './index';

/** Epoch milliseconds on the database clock, read when the statement runs. */
export const DB_NOW_MS = 'UNIX_MILLIS(CURRENT_TIMESTAMP())';

/**
 * The check half of a fenced write; call it first inside the write's
 * read-write transaction. Reads in a read-write transaction lock the rows they
 * return until commit, so a claim that updates the row either waits for the
 * write to commit or aborts it, and the retried write sees the new claim.
 */
export async function assertRunFence(
  tx: Transaction,
  claimsTable: string,
  fence: RunFence,
  operation: string,
): Promise<void> {
  const [rows] = await tx.run({
    sql: `SELECT generation, ${quoteIdent('ownerId', 'column name')} AS ownerId
          FROM ${quoteIdent(claimsTable, 'table name')}
          WHERE ${quoteIdent('runId', 'column name')} = @runId`,
    params: { runId: fence.runId },
    json: true,
  });
  const row = (rows as Array<{ generation: number | string; ownerId: string }>)[0];
  const current = row ? { generation: Number(row.generation), ownerId: String(row.ownerId) } : null;
  if (!matchesRunFence(current, fence)) {
    throw new RunFenceConflictError(fence, operation);
  }
}

/**
 * Runs `fn` in a read-write transaction and commits it, retrying the whole
 * transaction when Spanner aborts it for conflicting with another one.
 */
export function inTransaction<T>(db: SpannerDB, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.runWithAbortRetry(() =>
    db.database.runTransactionAsync(async (tx: Transaction) => {
      try {
        const result = await fn(tx);
        await tx.commit();
        return result;
      } catch (err) {
        // The client does not roll back when the callback throws; release the
        // transaction so its locks are freed.
        await tx.rollback().catch(rollbackErr => {
          throw new AggregateError([err, rollbackErr], 'Transaction and rollback both failed');
        });
        throw err;
      }
    }),
  );
}

/**
 * Runs `write` directly when it carries no fence, or in a transaction behind
 * the fence check when it does.
 */
export function withRunFence<T>(
  db: SpannerDB,
  claimsTable: string,
  fence: RunFence | undefined,
  operation: string,
  write: (tx: Transaction | undefined) => Promise<T>,
): Promise<T> {
  if (!fence) return write(undefined);
  return inTransaction(db, async tx => {
    await assertRunFence(tx, claimsTable, fence, operation);
    return write(tx);
  });
}
