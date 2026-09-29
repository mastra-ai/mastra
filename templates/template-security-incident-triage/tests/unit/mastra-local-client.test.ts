import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { afterEach, expect, it } from 'vitest';
import { createClient } from '@libsql/client';
import { createMastraLocalClient } from '../../src/db/mastra-local-client.js';
import { toStorageError } from '../../src/domain/errors.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const databases: TempDatabase[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map(db => db.cleanup()));
});

it('queues snapshot/trace writes behind operational transactions without starving their commit', async () => {
  const db = await createTempDatabase();
  databases.push(db);
  const operational = db.createStore();
  const mastra = createMastraLocalClient({ url: db.url });
  try {
    await operational.execute({
      sql: 'CREATE TABLE writes (id TEXT PRIMARY KEY)',
    });
    let pending!: Promise<unknown>;
    await operational.transaction(async tx => {
      await tx.execute({ sql: "INSERT INTO writes VALUES ('operational')" });
      pending = mastra.batch(["INSERT INTO writes VALUES ('trace')"]);
      await new Promise(resolve => setTimeout(resolve, 20));
      expect((await tx.execute({ sql: 'SELECT count(*) AS n FROM writes' })).rows[0]?.n).toBe(1);
    });
    await pending;
    expect((await mastra.execute('SELECT count(*) AS n FROM writes')).rows[0]?.n).toBe(2);
    const tx = await mastra.transaction();
    await tx.execute("INSERT INTO writes VALUES ('snapshot')");
    const op = operational.execute({
      sql: "INSERT INTO writes VALUES ('next')",
    });
    await tx.rollback();
    await op;
    expect((await mastra.execute('SELECT count(*) AS n FROM writes')).rows[0]?.n).toBe(3);
  } finally {
    operational.close();
    await mastra.close();
  }
});

it('retries contention with an independent connection while its commit timer keeps running', async () => {
  const db = await createTempDatabase();
  databases.push(db);
  const external = createClient({ url: db.url, timeout: 0 });
  const mastra = createMastraLocalClient({ url: db.url });
  try {
    await external.execute('PRAGMA journal_mode=WAL');
    await external.execute('CREATE TABLE writes (id INTEGER PRIMARY KEY)');
    const tx = await external.transaction('write');
    await tx.execute('INSERT INTO writes VALUES (1)');
    const committed = new Promise<void>((resolve, reject) =>
      setTimeout(() => {
        void tx.commit().then(resolve, reject);
      }, 50),
    );
    await Promise.all([committed, mastra.batch(['INSERT INTO writes VALUES (2)'])]);
    tx.close();
    expect((await mastra.execute('SELECT count(*) AS n FROM writes')).rows[0]?.n).toBe(2);
  } finally {
    external.close();
    await mastra.close();
  }
});

it.each(['SQLITE_BUSY_SNAPSHOT', 'SQLITE_BUSY_RECOVERY', 'SQLITE_LOCKED_SHAREDCACHE'])(
  'classifies %s as retryable storage contention',
  code => {
    expect(toStorageError({ code })).toMatchObject({
      code: 'STORAGE_UNAVAILABLE',
      retryable: true,
    });
  },
);

it('persists writes while another process owns the same SQLite file', async () => {
  const db = await createTempDatabase();
  databases.push(db);
  const mastra = createMastraLocalClient({ url: db.url });
  await mastra.execute('CREATE TABLE writes (id INTEGER PRIMARY KEY)');
  const child = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import { createClient } from '@libsql/client';
    const client = createClient({ url: process.argv[1], timeout: 0 });
    const tx = await client.transaction('write');
    await tx.execute('INSERT INTO writes VALUES (0)');
    console.log('locked');
    await new Promise(resolve => setTimeout(resolve, 100));
    await tx.commit(); tx.close(); client.close();
  `,
      db.url,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const exited = once(child, 'exit');
  try {
    await once(child.stdout, 'data');
    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        mastra.batch([
          {
            sql: 'INSERT INTO writes VALUES (?)',
            args: [index + 1],
          },
        ]),
      ),
    );
    expect((await exited)[0]).toBe(0);
    expect((await mastra.execute('SELECT count(*) AS n FROM writes')).rows[0]?.n).toBe(11);
  } finally {
    child.kill();
    await mastra.close();
  }
});
