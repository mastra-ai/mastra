import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { afterEach, describe, expect, it } from 'vitest';

import { wrapLocalClient } from './index';

// These tests intentionally use the REAL @libsql/client driver (not a mock),
// because the bug being guarded against lives in the driver's local sqlite3
// transport: `transaction()` detaches the client's single connection and the
// next execute()/batch() lazily opens a brand-new one. See wrapLocalClient.
//
// Upstream issues:
//   - https://github.com/tursodatabase/libsql-client-ts/issues/229 (:memory: discarded)
//   - https://github.com/tursodatabase/libsql-client-ts/issues/288 (file: busy_timeout dropped)

const tempFiles: string[] = [];

function tempDbUrl(): string {
  const path = join(tmpdir(), `libsql-churn-${process.pid}-${Math.random().toString(36).slice(2)}.db`);
  tempFiles.push(path);
  return `file:${path}`;
}

afterEach(() => {
  for (const path of tempFiles.splice(0)) {
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      try {
        rmSync(path + suffix);
      } catch {
        // ignore
      }
    }
  }
});

describe('@libsql/client local transaction() churn (baseline behavior)', () => {
  it('drops in-memory tables on the next execute after a transaction', async () => {
    const client = createClient({ url: ':memory:' });
    await client.execute('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');
    await client.execute("INSERT INTO t (v) VALUES ('hello')");

    const tx = await client.transaction('write');
    await tx.rollback();

    // The driver opened a fresh, empty in-memory database for this connection.
    await expect(client.execute('SELECT * FROM t')).rejects.toThrow(/no such table/i);
  });

  it('loses busy_timeout on the next connection after a transaction', async () => {
    const client = createClient({ url: tempDbUrl() });
    await client.execute('PRAGMA busy_timeout=5000');
    await client.execute('CREATE TABLE t (id INTEGER PRIMARY KEY)');

    const tx = await client.transaction('write');
    await tx.rollback();

    const result = await client.execute('PRAGMA busy_timeout');
    expect(Number(result.rows[0]!.timeout)).toBe(0);
  });
});

describe('wrapLocalClient', () => {
  it('keeps in-memory tables visible across a transaction', async () => {
    const client = wrapLocalClient(createClient({ url: ':memory:' }));
    await client.execute('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');
    await client.execute("INSERT INTO t (v) VALUES ('hello')");

    const tx = await client.transaction('write');
    await tx.execute("INSERT INTO t (v) VALUES ('world')");
    await tx.commit();

    const result = await client.execute('SELECT * FROM t ORDER BY id');
    expect(result.rows).toHaveLength(2);
  });

  it('keeps tables visible inside a subsequent transaction', async () => {
    const client = wrapLocalClient(createClient({ url: ':memory:' }));
    await client.execute('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');

    // First transaction triggers the driver-level churn in the unwrapped case.
    const tx1 = await client.transaction('write');
    await tx1.execute("INSERT INTO t (v) VALUES ('a')");
    await tx1.commit();

    // A second transaction must still be able to read the table.
    const tx2 = await client.transaction('write');
    const rows = await tx2.execute('SELECT COUNT(*) AS c FROM t');
    await tx2.commit();

    expect(Number(rows.rows[0]!.c)).toBe(1);
  });

  it('preserves busy_timeout across a transaction on a file database', async () => {
    const client = wrapLocalClient(createClient({ url: tempDbUrl() }));
    await client.execute('PRAGMA busy_timeout=5000');
    await client.execute('CREATE TABLE t (id INTEGER PRIMARY KEY)');

    const tx = await client.transaction('write');
    await tx.execute('INSERT INTO t DEFAULT VALUES');
    await tx.commit();

    const result = await client.execute('PRAGMA busy_timeout');
    expect(Number(result.rows[0]!.timeout)).toBe(5000);
  });

  it('rolls back a transaction without committing', async () => {
    const client = wrapLocalClient(createClient({ url: ':memory:' }));
    await client.execute('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');

    const tx = await client.transaction('write');
    await tx.execute("INSERT INTO t (v) VALUES ('temp')");
    await tx.rollback();

    const result = await client.execute('SELECT COUNT(*) AS c FROM t');
    expect(Number(result.rows[0]!.c)).toBe(0);
  });

  it('supports batch() inside a transaction', async () => {
    const client = wrapLocalClient(createClient({ url: ':memory:' }));
    await client.execute('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');

    const tx = await client.transaction('write');
    await tx.batch([
      { sql: 'INSERT INTO t (v) VALUES (?)', args: ['x'] },
      { sql: 'INSERT INTO t (v) VALUES (?)', args: ['y'] },
    ]);
    await tx.commit();

    const result = await client.execute('SELECT COUNT(*) AS c FROM t');
    expect(Number(result.rows[0]!.c)).toBe(2);
  });

  it('reports closed state after commit and rejects further use', async () => {
    const client = wrapLocalClient(createClient({ url: ':memory:' }));
    await client.execute('CREATE TABLE t (id INTEGER PRIMARY KEY)');

    const tx = await client.transaction('write');
    expect(tx.closed).toBe(false);
    await tx.commit();
    expect(tx.closed).toBe(true);
    await expect(tx.execute('SELECT 1')).rejects.toThrow(/closed/i);
  });

  it('leaves non-transaction client methods intact', async () => {
    const client = wrapLocalClient(createClient({ url: ':memory:' }));
    const result = await client.execute('SELECT 1 AS one');
    expect(Number(result.rows[0]!.one)).toBe(1);
    expect(typeof client.close).toBe('function');
  });

  it('clears the connection and frees the slot when COMMIT fails', async () => {
    const client = wrapLocalClient(createClient({ url: ':memory:' }));
    await client.execute('PRAGMA foreign_keys = ON');
    await client.execute('CREATE TABLE parent (id INTEGER PRIMARY KEY)');
    await client.execute(
      'CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
    );

    // A deferred foreign-key violation is only enforced at COMMIT time, so the
    // COMMIT itself rejects while the transaction is still open.
    const tx = await client.transaction('write');
    await tx.execute('INSERT INTO child (id, parent_id) VALUES (1, 999)');
    await expect(tx.commit()).rejects.toThrow(/foreign key/i);

    // The failed COMMIT must leave the transaction marked closed...
    expect(tx.closed).toBe(true);
    await expect(tx.execute('SELECT 1')).rejects.toThrow(/closed/i);

    // ...and the shared connection must be clean again, so a subsequent
    // transaction can BEGIN without hitting "transaction within a transaction".
    const tx2 = await client.transaction('write');
    await tx2.execute('INSERT INTO parent (id) VALUES (1)');
    await tx2.commit();

    const rows = await client.execute('SELECT COUNT(*) AS c FROM parent');
    expect(Number(rows.rows[0]!.c)).toBe(1);
  });
});
