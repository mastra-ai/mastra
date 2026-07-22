import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { SqliteClient } from '@mastra/libsql';
import { afterEach, describe, expect, it } from 'vitest';

import { TursoSqliteClient } from './client';
import { getTursoDatabaseSupport } from './support';

const support = getTursoDatabaseSupport();
const describeNative = support.supported ? describe : describe.skip;
const clients: SqliteClient[] = [];
const directories: string[] = [];

async function captureError(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error('Expected promise to reject.');
}

async function createFileClient(options: { experimental?: Array<'multiprocess_wal'> } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'mastra-turso-client-'));
  directories.push(directory);
  const databasePath = path.join(directory, 'test.db');
  const client = new TursoSqliteClient({ path: databasePath, ...options });
  clients.push(client);
  return { client, databasePath };
}

afterEach(async () => {
  await Promise.allSettled(clients.splice(0).map(client => client.close()));
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describeNative('TursoSqliteClient', () => {
  it('normalizes safe integers, preserves large integers, blobs, and nulls', async () => {
    const { client } = await createFileClient();
    await client.execute('CREATE TABLE values_test (safe INTEGER, large INTEGER, blob BLOB, nullable TEXT)');
    await client.execute({
      sql: 'INSERT INTO values_test VALUES (?, ?, ?, ?)',
      args: [42, 9007199254740993n, new Uint8Array([1, 2, 3]), null],
    });

    const result = await client.execute('SELECT safe, large, blob, nullable FROM values_test');

    expect(result.rows[0]).toMatchObject({ safe: 42, large: 9007199254740993n, nullable: null });
    expect(result.rows[0]!.blob).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(result.rows[0]!.blob as ArrayBuffer))).toEqual([1, 2, 3]);
  });

  it('preserves SQL NULL values passed through generated jsonb placeholders', async () => {
    const { client } = await createFileClient();
    await client.execute('CREATE TABLE json_values (id TEXT, value JSONB)');
    await client.execute({ sql: 'INSERT INTO json_values VALUES (?, jsonb(?))', args: ['null', null] });
    await client.execute({ sql: 'INSERT INTO json_values VALUES (?, jsonb(?))', args: ['object', '{"ok":true}'] });

    await expect(client.execute('SELECT id FROM json_values WHERE value IS NULL')).resolves.toMatchObject({
      rows: [{ id: 'null' }],
    });
    await expect(client.execute('SELECT id FROM json_values WHERE value IS NOT NULL')).resolves.toMatchObject({
      rows: [{ id: 'object' }],
    });
  });

  it('maps batches atomically and preserves result order', async () => {
    const { client } = await createFileClient();
    await client.execute('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT UNIQUE)');

    const results = await client.batch(
      [
        { sql: 'INSERT INTO items (name) VALUES (?) RETURNING name', args: ['one'] },
        { sql: 'INSERT INTO items (name) VALUES (?) RETURNING name', args: ['two'] },
      ],
      'write',
    );

    expect(results.map(result => result.rows[0]!.name)).toEqual(['one', 'two']);
    await expect(
      client.batch(
        [
          { sql: 'INSERT INTO items (name) VALUES (?)', args: ['three'] },
          { sql: 'INSERT INTO items (name) VALUES (?)', args: ['one'] },
        ],
        'write',
      ),
    ).rejects.toThrow();
    await expect(client.execute('SELECT name FROM items ORDER BY id')).resolves.toMatchObject({
      rows: [{ name: 'one' }, { name: 'two' }],
    });
  });

  it('normalizes SQLite constraint error codes used by storage domains', async () => {
    const { client } = await createFileClient();
    await client.execute('CREATE TABLE unique_values (value TEXT UNIQUE)');
    await client.execute({ sql: 'INSERT INTO unique_values VALUES (?)', args: ['duplicate'] });

    const error = await captureError(
      client.execute({ sql: 'INSERT INTO unique_values VALUES (?)', args: ['duplicate'] }),
    );
    expect(error).toMatchObject({ code: 'SQLITE_CONSTRAINT_UNIQUE' });
  });

  it('commits and rolls back interactive transactions', async () => {
    const { client } = await createFileClient();
    await client.execute('CREATE TABLE items (name TEXT)');

    const committed = await client.transaction('write');
    await committed.execute({ sql: 'INSERT INTO items VALUES (?)', args: ['committed'] });
    await committed.commit();
    expect(committed.closed).toBe(true);

    const rolledBack = await client.transaction('write');
    await rolledBack.execute({ sql: 'INSERT INTO items VALUES (?)', args: ['rolled-back'] });
    await rolledBack.rollback();
    expect(rolledBack.closed).toBe(true);

    const closed = await client.transaction('write');
    await closed.execute({ sql: 'INSERT INTO items VALUES (?)', args: ['closed'] });
    await closed.close();
    expect(closed.closed).toBe(true);

    await expect(client.execute('SELECT name FROM items')).resolves.toMatchObject({ rows: [{ name: 'committed' }] });
  });

  it('rolls back all writes after a multi-statement transaction fails', async () => {
    const { client } = await createFileClient();
    await client.batch(['CREATE TABLE items (name TEXT UNIQUE)', 'CREATE TABLE versions (value INTEGER)']);

    const transaction = await client.transaction('write');
    await transaction.execute({ sql: 'INSERT INTO items VALUES (?)', args: ['first'] });
    await transaction.execute({ sql: 'INSERT INTO versions VALUES (?)', args: [1] });
    await expect(transaction.execute({ sql: 'INSERT INTO items VALUES (?)', args: ['first'] })).rejects.toThrow();
    await transaction.rollback();

    await expect(client.execute('SELECT name FROM items')).resolves.toMatchObject({ rows: [] });
    await expect(client.execute('SELECT value FROM versions')).resolves.toMatchObject({ rows: [] });
  });

  it('blocks unrelated operations until an interactive transaction settles', async () => {
    const { client } = await createFileClient();
    await client.execute('CREATE TABLE items (name TEXT)');

    const transaction = await client.transaction('write');
    await transaction.execute({ sql: 'INSERT INTO items VALUES (?)', args: ['transaction'] });
    let outsideSettled = false;
    const outside = client
      .execute({ sql: 'INSERT INTO items VALUES (?)', args: ['outside'] })
      .then(() => (outsideSettled = true));

    await new Promise(resolve => setTimeout(resolve, 20));
    expect(outsideSettled).toBe(false);
    await transaction.commit();
    await outside;

    await expect(client.execute('SELECT name FROM items ORDER BY rowid')).resolves.toMatchObject({
      rows: [{ name: 'transaction' }, { name: 'outside' }],
    });
  });

  it('rolls back an active transaction during overlapping close calls', async () => {
    const { client, databasePath } = await createFileClient();
    await client.execute('CREATE TABLE items (name TEXT)');
    const transaction = await client.transaction('write');
    await transaction.execute({ sql: 'INSERT INTO items VALUES (?)', args: ['rolled-back'] });

    await Promise.all([client.close(), client.close()]);
    expect(client.closed).toBe(true);
    await expect(client.execute('SELECT 1')).rejects.toThrow('Turso client is closed');

    const reopened = new TursoSqliteClient({ path: databasePath });
    clients.push(reopened);
    await expect(reopened.execute('SELECT name FROM items')).resolves.toMatchObject({ rows: [] });
  });

  it('replays connection failures without loading a usable client', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'mastra-turso-missing-'));
    directories.push(directory);
    const client = new TursoSqliteClient({ path: path.join(directory, 'missing.db'), fileMustExist: true });
    clients.push(client);

    const first = await captureError(client.execute('SELECT 1'));
    const second = await captureError(client.execute('SELECT 1'));

    expect(first).toBeInstanceOf(Error);
    expect(second).toBeInstanceOf(Error);
    expect(second.message).toBe(first.message);
  });
});
