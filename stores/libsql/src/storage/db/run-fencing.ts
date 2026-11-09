import type { RunFence } from '@mastra/core/storage';
import { matchesRunFence, RunFenceConflictError } from '@mastra/core/storage';
import type { SqliteClient, SqliteResultSet, SqliteStatement, SqliteTransaction } from './client';
import { withClientWriteLock } from './write-lock';

/** Runs statements against the client, or inside an open transaction. */
export interface SqliteWriter {
  execute(statement: string | SqliteStatement): Promise<SqliteResultSet>;
  /** Runs `statements` in order, all or nothing. */
  batch(statements: SqliteStatement[]): Promise<SqliteResultSet[]>;
}

/** A write's fence, and the table holding the run's current claim to check it against. */
export interface RunFenceCheck {
  claimsTable: string;
  fence: RunFence;
  operation: string;
}

/**
 * Epoch milliseconds on the database clock. `julianday('now')` rather than
 * `unixepoch('subsec')`, which needs SQLite 3.42 on the server.
 */
export const DB_NOW_MS = `CAST(ROUND((julianday('now') - 2440587.5) * 86400000) AS INTEGER)`;

/**
 * Runs `fn` in a write transaction, behind every other write on `client`.
 * `'write'` opens the transaction with `BEGIN IMMEDIATE`, which takes the
 * database's write lock up front, so nothing written between a read and a
 * write inside `fn` can come from another connection.
 */
export function inWriteTransaction<T>(client: SqliteClient, fn: (tx: SqliteTransaction) => Promise<T>): Promise<T> {
  return withClientWriteLock(client, async () => {
    const tx = await client.transaction('write');
    try {
      const result = await fn(tx);
      await tx.commit();
      return result;
    } catch (error) {
      if (!tx.closed) await tx.rollback();
      throw error;
    } finally {
      if (!tx.closed) tx.close();
    }
  });
}

/**
 * The check half of a fenced write; call it first inside the write's
 * transaction. The transaction already holds the database's write lock, so
 * a claim can't commit between this check and the write.
 */
export async function assertRunFence(
  tx: Pick<SqliteTransaction, 'execute'>,
  { claimsTable, fence, operation }: RunFenceCheck,
): Promise<void> {
  const result = await tx.execute({
    sql: `SELECT generation, ownerId FROM ${claimsTable} WHERE runId = ?`,
    args: [fence.runId],
  });
  const row = result.rows[0];
  const current = row ? { generation: Number(row.generation), ownerId: String(row.ownerId) } : null;
  if (!matchesRunFence(current, fence)) {
    throw new RunFenceConflictError(fence, operation);
  }
}

/**
 * Runs `write` behind the client's write lock: directly when there is no
 * fence to check, or in a write transaction behind the check when there is.
 * `write` must issue every statement through the writer it is given; on a
 * single-connection client, a call on the client itself would wait for the
 * open transaction forever.
 */
export function withRunFence<T>(
  client: SqliteClient,
  check: RunFenceCheck | undefined,
  write: (writer: SqliteWriter) => Promise<T>,
): Promise<T> {
  if (!check) {
    return withClientWriteLock(client, () =>
      write({
        execute: statement => client.execute(statement),
        batch: statements => client.batch(statements, 'write'),
      }),
    );
  }
  return inWriteTransaction(client, async tx => {
    await assertRunFence(tx, check);
    return write({
      execute: statement => tx.execute(statement),
      batch: async statements => {
        const results: SqliteResultSet[] = [];
        for (const statement of statements) results.push(await tx.execute(statement));
        return results;
      },
    });
  });
}
