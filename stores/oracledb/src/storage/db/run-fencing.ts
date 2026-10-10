import type { RunFence } from '@mastra/core/storage';
import { matchesRunFence, RunFenceConflictError } from '@mastra/core/storage';

import { isOracleErrorCode } from '../../shared/connection';
import type { OracleDB, OracleTxClient } from './index';

const SINCE_EPOCH = `(SYS_EXTRACT_UTC(SYSTIMESTAMP) - TIMESTAMP '1970-01-01 00:00:00')`;

/**
 * Epoch milliseconds on the database clock. Oracle evaluates `SYSTIMESTAMP`
 * once per statement, so every reference here reads the same instant, and a
 * statement that waits on a lock compares against the time it started. That
 * error only makes an existing lease look longer and a new lease shorter.
 */
export const DB_NOW_MS = `(EXTRACT(DAY FROM ${SINCE_EPOCH}) * 86400000 + EXTRACT(HOUR FROM ${SINCE_EPOCH}) * 3600000 + EXTRACT(MINUTE FROM ${SINCE_EPOCH}) * 60000 + FLOOR(EXTRACT(SECOND FROM ${SINCE_EPOCH}) * 1000))`;

const ORA_UNIQUE_CONSTRAINT = -1;
const ORA_DEADLOCK = -60;
const MAX_CLAIM_ATTEMPTS = 5;

/**
 * The check half of a fenced write; call it first inside the write's
 * transaction. Oracle has no shared row lock, so this takes the claim row
 * `FOR UPDATE`: a claim that updates the row waits for the write to commit,
 * and a write queued behind a claim re-reads the row once the claim commits
 * and sees the new generation. Writes from one run serialize on its row,
 * which they mostly do anyway.
 */
export async function assertRunFence(
  client: OracleTxClient,
  claimsTable: string,
  fence: RunFence,
  operation: string,
): Promise<void> {
  const row = await client.oneOrNone<{ generation: number; ownerId: string }>(
    `SELECT generation AS "generation", "ownerId" FROM ${claimsTable} WHERE "runId" = :runId FOR UPDATE`,
    { runId: fence.runId },
  );
  const current = row ? { generation: Number(row.generation), ownerId: String(row.ownerId) } : null;
  if (!matchesRunFence(current, fence)) {
    throw new RunFenceConflictError(fence, operation);
  }
}

/**
 * Runs `write` in a transaction, behind the fence check when it carries a
 * fence.
 */
export function withRunFence<T>(
  db: OracleDB,
  claimsTable: string,
  fence: RunFence | undefined,
  operation: string,
  write: (client: OracleTxClient) => Promise<T>,
): Promise<T> {
  return db.tx(async client => {
    if (fence) await assertRunFence(client, claimsTable, fence, operation);
    return write(client);
  });
}

/**
 * Runs a transaction that creates or updates a run's claim row, retrying when
 * two first claims race to insert it. `FOR UPDATE` locks nothing while the row
 * is missing, so racing first claims both insert; the second waits on the
 * primary key and fails once the first commits. On retry the row exists and
 * the claim serializes behind its row lock. A deadlock is retried too.
 */
export async function claimTransaction<T>(db: OracleDB, fn: (client: OracleTxClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.tx(client => fn(client));
    } catch (error) {
      const retryable = isOracleErrorCode(error, [ORA_UNIQUE_CONSTRAINT, ORA_DEADLOCK]);
      if (attempt >= MAX_CLAIM_ATTEMPTS || !retryable) throw error;
    }
  }
}
