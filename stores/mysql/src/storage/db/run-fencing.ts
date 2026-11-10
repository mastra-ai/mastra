import type { RunFence } from '@mastra/core/storage';
import { matchesRunFence, RunFenceConflictError } from '@mastra/core/storage';
import type { Connection, Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { quoteIdentifier } from '../domains/utils';

/** The query method both the pool and a pooled connection offer. */
export type Queryable = Pick<Connection, 'execute'>;

/**
 * Epoch milliseconds on the database clock. `UTC_TIMESTAMP` is the time the
 * statement started and doesn't depend on the session time zone. Every lease
 * comparison runs in a statement that already holds the run's owner row, so
 * no lock wait sits between that start time and the comparison.
 */
export const DB_NOW_MS = `(TIMESTAMPDIFF(MICROSECOND, '1970-01-01 00:00:00', UTC_TIMESTAMP(3)) DIV 1000)`;

const ER_DUP_ENTRY = 1062;
const ER_LOCK_DEADLOCK = 1213;
const MAX_CLAIM_ATTEMPTS = 5;

/**
 * The check half of a fenced write; call it first inside the write's
 * transaction. The shared lock holds the claim row until commit, so a claim
 * that updates the row waits for the write to finish, and every later write
 * sees the new claim.
 */
export async function assertRunFence(
  q: Queryable,
  claimsTable: string,
  fence: RunFence,
  operation: string,
): Promise<void> {
  const [rows] = await q.execute<RowDataPacket[]>(
    `SELECT generation, ${quoteIdentifier('ownerId', 'column name')} AS ownerId FROM ${claimsTable}
     WHERE ${quoteIdentifier('runId', 'column name')} = ? LOCK IN SHARE MODE`,
    [fence.runId],
  );
  const row = rows[0];
  const current = row ? { generation: Number(row.generation), ownerId: String(row.ownerId) } : null;
  if (!matchesRunFence(current, fence)) {
    throw new RunFenceConflictError(fence, operation);
  }
}

/** Runs `fn` in a transaction on its own pooled connection. */
export async function inTransaction<T>(pool: Pool, fn: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Runs `write` directly when it carries no fence, or in a transaction behind
 * the fence check when it does.
 */
export function withRunFence<T>(
  pool: Pool,
  claimsTable: string,
  fence: RunFence | undefined,
  operation: string,
  write: (q: Queryable) => Promise<T>,
): Promise<T> {
  if (!fence) return write(pool);
  return inTransaction(pool, async connection => {
    await assertRunFence(connection, claimsTable, fence, operation);
    return write(connection);
  });
}

/**
 * Runs a transaction that creates or updates a run's claim row, retrying when
 * two first claims race to insert it. Under REPEATABLE READ both lock the gap
 * where the row would go and one is chosen as a deadlock victim; under READ
 * COMMITTED the later insert hits the duplicate key. On retry the row exists
 * and the claim serializes behind its row lock.
 */
export async function claimTransaction<T>(pool: Pool, fn: (connection: PoolConnection) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await inTransaction(pool, fn);
    } catch (error) {
      const errno = (error as { errno?: number }).errno;
      if (attempt >= MAX_CLAIM_ATTEMPTS || (errno !== ER_DUP_ENTRY && errno !== ER_LOCK_DEADLOCK)) throw error;
    }
  }
}
