import { createClient } from '@libsql/client';
import { describe, expect, it } from 'vitest';

import { gateSingleConnectionClient, isSingleConnectionDatabase } from './single-connection-client';

describe('isSingleConnectionDatabase', () => {
  it('is true for in-memory urls and embedded replicas only', () => {
    expect(isSingleConnectionDatabase({ url: ':memory:' })).toBe(true);
    expect(isSingleConnectionDatabase({ url: 'file::memory:?cache=shared' })).toBe(true);
    expect(isSingleConnectionDatabase({ url: 'file:local.db', syncUrl: 'libsql://x.turso.io' })).toBe(true);
    expect(isSingleConnectionDatabase({ url: 'file:local.db' })).toBe(false);
    expect(isSingleConnectionDatabase({ url: 'libsql://x.turso.io' })).toBe(false);
  });
});

describe('gateSingleConnectionClient', () => {
  const setup = async () => {
    const client = gateSingleConnectionClient(createClient({ url: ':memory:' }));
    await client.execute('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');
    return client;
  };

  it('queues execute behind an open transaction instead of throwing TRANSACTION_ACTIVE', async () => {
    const client = await setup();
    const tx = await client.transaction('write');
    await tx.execute({ sql: 'INSERT INTO t (v) VALUES (?)', args: ['in-tx'] });

    let settled = false;
    const outside = client.execute({ sql: 'INSERT INTO t (v) VALUES (?)', args: ['outside'] }).then(() => {
      settled = true;
    });
    await new Promise(r => setTimeout(r, 20));
    expect(settled).toBe(false);

    await tx.commit();
    await outside;

    const rows = await client.execute('SELECT v FROM t ORDER BY id');
    expect(rows.rows.map(r => r.v)).toEqual(['in-tx', 'outside']);
    client.close();
  });

  it('serializes concurrent transactions', async () => {
    const client = await setup();
    await Promise.all(
      Array.from({ length: 5 }, async (_, i) => {
        const tx = await client.transaction('write');
        await tx.execute({ sql: 'INSERT INTO t (v) VALUES (?)', args: [`a${i}`] });
        await tx.execute({ sql: 'INSERT INTO t (v) VALUES (?)', args: [`b${i}`] });
        await tx.commit();
      }),
    );
    const rows = await client.execute('SELECT COUNT(*) AS n FROM t');
    expect(rows.rows[0]!.n).toBe(10);
    client.close();
  });

  it('releases the gate on rollback and on close without commit', async () => {
    const client = await setup();

    const tx1 = await client.transaction('write');
    await tx1.execute({ sql: 'INSERT INTO t (v) VALUES (?)', args: ['rolled'] });
    await tx1.rollback();

    const tx2 = await client.transaction('write');
    await tx2.execute({ sql: 'INSERT INTO t (v) VALUES (?)', args: ['closed'] });
    tx2.close();

    const rows = await client.execute('SELECT COUNT(*) AS n FROM t');
    expect(rows.rows[0]!.n).toBe(0);
    client.close();
  });
});
