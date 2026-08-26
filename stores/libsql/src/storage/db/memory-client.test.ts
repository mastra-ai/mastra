import { createClient } from '@libsql/client';
import { describe, expect, it } from 'vitest';

import type { SqliteClient } from './client';
import { isPrivateMemoryUrl, wrapMemoryClient } from './memory-client';

const createMemoryClient = (): SqliteClient => wrapMemoryClient(createClient({ url: ':memory:' }) as SqliteClient);

describe('isPrivateMemoryUrl', () => {
  it.each([
    [':memory:', true],
    ['file::memory:', true],
    ['file::memory:?cache=private', true],
    ['FILE::MEMORY:', true],
    ['file::memory:?cache=shared', false],
    ['file:./local.db', false],
    ['file:memory.db', false],
    ['libsql://example.turso.io', false],
    ['https://example.turso.io', false],
  ])('%s -> %s', (url, expected) => {
    expect(isPrivateMemoryUrl(url)).toBe(expected);
  });
});

describe('wrapMemoryClient', () => {
  it('keeps data written before an interactive transaction (issue #22328)', async () => {
    const client = createMemoryClient();
    await client.execute('CREATE TABLE t (id TEXT)');
    await client.execute("INSERT INTO t VALUES ('before')");

    const tx = await client.transaction('write');
    await tx.execute("INSERT INTO t VALUES ('inside')");
    await tx.commit();

    // Without the wrapper this throws `SQLITE_ERROR: no such table: t`
    // because @libsql/client reopens a brand-new empty :memory: database.
    const result = await client.execute('SELECT id FROM t ORDER BY id');
    expect(result.rows.map(row => row.id)).toEqual(['before', 'inside']);
  });

  it('rollback discards writes but keeps the database', async () => {
    const client = createMemoryClient();
    await client.execute('CREATE TABLE t (id TEXT)');

    const tx = await client.transaction('write');
    await tx.execute("INSERT INTO t VALUES ('discarded')");
    await tx.rollback();

    const result = await client.execute('SELECT count(*) AS n FROM t');
    expect(result.rows[0]?.n).toBe(0);
    expect(tx.closed).toBe(true);
  });

  it('close() rolls back an open transaction', async () => {
    const client = createMemoryClient();
    await client.execute('CREATE TABLE t (id TEXT)');

    const tx = await client.transaction('write');
    await tx.execute("INSERT INTO t VALUES ('discarded')");
    tx.close();
    expect(tx.closed).toBe(true);

    const result = await client.execute('SELECT count(*) AS n FROM t');
    expect(result.rows[0]?.n).toBe(0);
  });

  it('close() after commit is a no-op and use-after-close rejects', async () => {
    const client = createMemoryClient();
    await client.execute('CREATE TABLE t (id TEXT)');

    const tx = await client.transaction('write');
    await tx.execute("INSERT INTO t VALUES ('kept')");
    await tx.commit();
    tx.close();

    await expect(tx.execute('SELECT 1')).rejects.toThrow('The transaction is closed');
    await expect(tx.commit()).rejects.toThrow('The transaction is closed');
    // rollback after close is a no-op, matching @libsql/client behavior.
    await expect(tx.rollback()).resolves.toBeUndefined();

    const result = await client.execute('SELECT count(*) AS n FROM t');
    expect(result.rows[0]?.n).toBe(1);
  });

  it('sequential transactions and batches share the same database', async () => {
    const client = createMemoryClient();
    await client.execute('CREATE TABLE t (id TEXT)');

    const first = await client.transaction('write');
    await first.execute("INSERT INTO t VALUES ('a')");
    await first.commit();

    await client.batch(["INSERT INTO t VALUES ('b')"], 'write');

    const second = await client.transaction('write');
    await second.execute("INSERT INTO t VALUES ('c')");
    await second.commit();

    const result = await client.execute('SELECT count(*) AS n FROM t');
    expect(result.rows[0]?.n).toBe(3);
  });
});
