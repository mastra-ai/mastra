import { afterEach, describe, expect, it } from 'vitest';

import { DomainError } from '../../src/domain/errors.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const databases: TempDatabase[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

describe('operational store transactions', () => {
  it('commits success and rolls back exceptions atomically', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    try {
      await store.execute({
        sql: 'CREATE TABLE sample(id TEXT PRIMARY KEY) STRICT',
      });
      await store.transaction(async tx => {
        await tx.execute({
          sql: 'INSERT INTO sample(id) VALUES (?)',
          args: ['kept'],
        });
      });
      await expect(
        store.transaction(async tx => {
          await tx.execute({
            sql: 'INSERT INTO sample(id) VALUES (?)',
            args: ['rolled-back'],
          });
          throw new DomainError('CONFLICT');
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      const rows = await store.execute({
        sql: 'SELECT id FROM sample ORDER BY id',
      });
      expect(rows.rows).toEqual([{ id: 'kept' }]);
    } finally {
      store.close();
    }
  });

  it('rolls back a batch failure and releases the write lock', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const first = database.createStore();
    const second = database.createStore();
    try {
      await first.execute({
        sql: 'CREATE TABLE sample(id TEXT PRIMARY KEY) STRICT',
      });
      await expect(
        first.transaction(tx =>
          tx.batch([
            { sql: "INSERT INTO sample(id) VALUES ('same')" },
            { sql: "INSERT INTO sample(id) VALUES ('same')" },
          ]),
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      await second.execute({ sql: "INSERT INTO sample(id) VALUES ('after')" });
      const count = await second.execute({
        sql: 'SELECT count(*) AS count FROM sample',
      });
      expect(Number(count.rows[0]?.count)).toBe(1);
    } finally {
      first.close();
      second.close();
    }
  });
});
