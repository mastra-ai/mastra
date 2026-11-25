import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

import { PinnedClientAdapter, PoolAdapter, TransactionRolledBackError } from './client';
import type { DbClient } from './client';
import { connectionString as defaultConnectionString } from './test-utils';

/**
 * A statement that fails outside a savepoint aborts the transaction, and Postgres answers the
 * COMMIT with ROLLBACK. `tx()` drains before COMMIT and rethrows a failure it kept, but a caller
 * that drained itself and swallowed that failure has already taken it: then only COMMIT's answer
 * says the writes are gone.
 */
const connectionString = process.env.KNOWLEDGE_PG_URL ?? defaultConnectionString;
const table = 'mastra_tx_rollback_at_commit_test';
const pool = new Pool({ connectionString });

afterAll(async () => {
  await pool.query(`DROP TABLE IF EXISTS ${table}`);
  await pool.end();
});

async function rowsAfter(adapter: DbClient) {
  await pool.query(`DROP TABLE IF EXISTS ${table}`);
  await pool.query(`CREATE TABLE ${table} (n int)`);
  const outcome = await adapter
    .tx(async t => {
      await t.none(`INSERT INTO ${table} VALUES (1)`);
      await t.none('SELECT 1/0').catch(() => {});
      await (t as unknown as { drain(): Promise<void> }).drain().catch(() => {});
      return 'resolved';
    })
    .catch((error: unknown) => error);
  const { rows } = await pool.query(`SELECT n FROM ${table}`);
  return { outcome, rows };
}

describe('a transaction whose failure was swallowed through an explicit drain()', () => {
  it('rejects at COMMIT on a pooled transaction', async () => {
    const { outcome, rows } = await rowsAfter(new PoolAdapter(pool));
    expect(outcome).toBeInstanceOf(TransactionRolledBackError);
    expect(rows).toEqual([]);
  });

  it('rejects at COMMIT on a pinned transaction', async () => {
    const client = await pool.connect();
    try {
      const { outcome, rows } = await rowsAfter(new PinnedClientAdapter(pool, client));
      expect(outcome).toBeInstanceOf(TransactionRolledBackError);
      expect(rows).toEqual([]);
    } finally {
      client.release();
    }
  });
});
