import type { RunFence } from '@mastra/core/storage';
import { matchesRunFence, RunFenceConflictError } from '@mastra/core/storage';
import type sql from 'mssql';

/** What both the pool and a transaction offer for issuing statements. */
export type Queryable = { request(): sql.Request };

/**
 * Epoch milliseconds on the database clock. SQL Server evaluates
 * `SYSUTCDATETIME()` once when a statement starts, so a statement that waits
 * on a lock compares against the time it started. That error only makes an
 * existing lease look longer and a new lease shorter.
 */
export const DB_NOW_MS = `DATEDIFF_BIG(MILLISECOND, '1970-01-01', SYSUTCDATETIME())`;

const ERR_DEADLOCK_VICTIM = 1205;
const ERR_UNIQUE_INDEX = 2601;
const ERR_PRIMARY_KEY = 2627;
const MAX_CLAIM_ATTEMPTS = 5;

/**
 * The check half of a fenced write; call it first inside the write's
 * transaction. `HOLDLOCK` keeps the shared lock on the claim row until commit,
 * even on databases with read-committed snapshot on, so a claim that updates
 * the row waits for the write to finish, and every later write sees the new
 * claim.
 */
export async function assertRunFence(
  q: Queryable,
  claimsTable: string,
  fence: RunFence,
  operation: string,
): Promise<void> {
  const result = await q
    .request()
    .input('runId', fence.runId)
    .query(`SELECT [generation], [ownerId] FROM ${claimsTable} WITH (HOLDLOCK) WHERE [runId] = @runId`);
  const row = result.recordset[0];
  const current = row ? { generation: Number(row.generation), ownerId: String(row.ownerId) } : null;
  if (!matchesRunFence(current, fence)) {
    throw new RunFenceConflictError(fence, operation);
  }
}

/** Runs `fn` in a transaction. */
export async function inTransaction<T>(
  pool: sql.ConnectionPool,
  fn: (transaction: sql.Transaction) => Promise<T>,
): Promise<T> {
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    const result = await fn(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    // The server has already rolled back a deadlock victim's transaction.
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

/**
 * Runs `write` directly when it carries no fence, or in a transaction behind
 * the fence check when it does.
 */
export function withRunFence<T>(
  pool: sql.ConnectionPool,
  claimsTable: string,
  fence: RunFence | undefined,
  operation: string,
  write: (q: Queryable) => Promise<T>,
): Promise<T> {
  if (!fence) return write(pool);
  return inTransaction(pool, async transaction => {
    await assertRunFence(transaction, claimsTable, fence, operation);
    return write(transaction);
  });
}

/**
 * Runs a transaction that creates or updates a run's claim row, retrying when
 * two first claims race to insert it. Claims read the row with
 * `UPDLOCK, HOLDLOCK`, which locks the key range of a missing row, so racing
 * first claims normally queue; the retry covers a deadlock victim or a
 * duplicate key if they don't. On retry the row exists and the claim
 * serializes behind its row lock.
 */
export async function claimTransaction<T>(
  pool: sql.ConnectionPool,
  fn: (transaction: sql.Transaction) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await inTransaction(pool, fn);
    } catch (error) {
      const number = (error as { number?: number }).number;
      const retryable = number === ERR_DEADLOCK_VICTIM || number === ERR_PRIMARY_KEY || number === ERR_UNIQUE_INDEX;
      if (attempt >= MAX_CLAIM_ATTEMPTS || !retryable) throw error;
    }
  }
}
