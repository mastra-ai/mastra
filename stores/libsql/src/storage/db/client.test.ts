import { createClient } from '@libsql/client';
import { afterEach, describe, expect, it } from 'vitest';

import type { SqliteClient } from './client';

const clients: SqliteClient[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map(client => client.close()));
});

describe('SqliteClient', () => {
  it('is implemented by @libsql/client', async () => {
    const client: SqliteClient = createClient({ url: 'file::memory:?cache=shared' });
    clients.push(client);

    await client.execute('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    const inserted = await client.execute({ sql: 'INSERT INTO items (name) VALUES (?)', args: ['execute'] });
    const batched = await client.batch(
      [
        { sql: 'INSERT INTO items (name) VALUES (?)', args: ['batch-1'] },
        { sql: 'INSERT INTO items (name) VALUES (?)', args: ['batch-2'] },
      ],
      'write',
    );

    const committed = await client.transaction('write');
    await committed.execute({ sql: 'INSERT INTO items (name) VALUES (?)', args: ['committed'] });
    await committed.commit();

    const rolledBack = await client.transaction('write');
    await rolledBack.execute({ sql: 'INSERT INTO items (name) VALUES (?)', args: ['rolled-back'] });
    await rolledBack.rollback();

    const selected = await client.execute('SELECT id, name FROM items ORDER BY id');

    expect(inserted.rowsAffected).toBe(1);
    expect(batched.map(result => result.rowsAffected)).toEqual([1, 1]);
    expect(committed.closed).toBe(true);
    expect(rolledBack.closed).toBe(true);
    expect(selected.rows).toEqual([
      { id: 1, name: 'execute' },
      { id: 2, name: 'batch-1' },
      { id: 3, name: 'batch-2' },
      { id: 4, name: 'committed' },
    ]);
  });
});
