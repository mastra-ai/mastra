import { mkdir } from 'node:fs/promises';
import { dirname, isAbsolute } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Client, type Pool } from 'pg';
import type { DbClient, TxClient } from '@mastra/pg';
import { canonicalDatabasePath, hostedMode, databaseUrlForPath, storageConfiguration } from '../database.ts';

// PostgreSQL advisory locks are database-scoped. Keep these namespace keys stable across workers and releases.
const postgresWriterKey = [0x4b534147, 0x57524954];

function writerClient(query: TxClient['query']): DbClient {
  let pending: Promise<unknown> = Promise.resolve();
  function serialize<T>(operation: () => Promise<T>) {
    const result = pending.then(operation);
    pending = result.catch(() => undefined);
    return result;
  }

  let statements: Promise<unknown> = Promise.resolve();
  const statement: TxClient['query'] = (sql, values) => {
    const result = statements.then(() => query(sql, values));
    statements = result.catch(() => undefined);
    return result;
  };
  const transaction: TxClient = {
    query: statement,
    async none(sql, values) {
      await statement(sql, values);
      return null;
    },
    async oneOrNone<T>(sql: string, values?: unknown[]) {
      const { rows } = await statement(sql, values);
      if (rows.length > 1) throw new Error('Expected at most one PostgreSQL row');
      return (rows[0] as T | undefined) ?? null;
    },
    async one<T>(sql: string, values?: unknown[]) {
      const row = await transaction.oneOrNone<T>(sql, values);
      if (!row) throw new Error('Expected one PostgreSQL row');
      return row;
    },
    async any<T>(sql: string, values?: unknown[]) {
      return (await statement(sql, values)).rows as T[];
    },
    manyOrNone: (sql, values) => transaction.any(sql, values),
    async many<T>(sql: string, values?: unknown[]) {
      const rows = await transaction.any<T>(sql, values);
      if (!rows.length) throw new Error('Expected PostgreSQL rows');
      return rows;
    },
    batch: promises => Promise.all(promises),
  };

  return {
    get $pool(): Pool {
      throw new Error('Support writer queries must use the locked transaction');
    },
    connect: async () => {
      throw new Error('Support writer queries must use the locked transaction');
    },
    query: (sql, values) => serialize(() => transaction.query(sql, values)),
    none: (sql, values) => serialize(() => transaction.none(sql, values)),
    one: (sql, values) => serialize(() => transaction.one(sql, values)),
    oneOrNone: (sql, values) => serialize(() => transaction.oneOrNone(sql, values)),
    any: (sql, values) => serialize(() => transaction.any(sql, values)),
    many: (sql, values) => serialize(() => transaction.many(sql, values)),
    manyOrNone: (sql, values) => serialize(() => transaction.manyOrNone(sql, values)),
    tx: operation =>
      serialize(async () => {
        // Serialize native adapter transactions as savepoints on the same connection.
        await transaction.none('SAVEPOINT support_writer_operation');
        try {
          const result = await operation(transaction);
          await transaction.none('RELEASE SAVEPOINT support_writer_operation');
          return result;
        } catch (error) {
          await transaction.none('ROLLBACK TO SAVEPOINT support_writer_operation').catch(() => undefined);
          await transaction.none('RELEASE SAVEPOINT support_writer_operation').catch(() => undefined);
          throw error;
        }
      }),
  };
}

export class WriterSessionLostError extends Error {
  constructor(cause: unknown) {
    super('PostgreSQL writer session was lost', { cause });
    this.name = 'WriterSessionLostError';
  }
}

async function withPostgresWriter<T>(connectionString: string, operation: (client: DbClient) => Promise<T>) {
  const connection = new Client({ connectionString, connectionTimeoutMillis: 10000 });
  let connectionError: Error | undefined;
  connection.on('error', error => {
    connectionError ??= error;
  });
  const client = writerClient(async (sql, values) => {
    if (connectionError) throw new WriterSessionLostError(connectionError);
    try {
      return await connection.query(sql, values);
    } catch (error) {
      if (connectionError) throw new WriterSessionLostError(error);
      throw error;
    }
  });
  let connected = false;
  try {
    await connection.connect();
    connected = true;
    await client.none('BEGIN');
    const { acquired } = await client.one<{ acquired: boolean }>(
      'SELECT pg_try_advisory_xact_lock($1, $2) AS acquired',
      postgresWriterKey,
    );
    if (!acquired) throw new WriterBusyError('PostgreSQL support writer');
    const result = await operation(client);
    const commit = await client.query('COMMIT');
    if (commit.command !== 'COMMIT') throw new Error('PostgreSQL writer transaction was rolled back');
    return result;
  } catch (error) {
    if (connected) await client.none('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await connection.end();
  }
}

type WriterContext = { databasePath: string; postgres?: never } | { databasePath?: never; postgres: DbClient };

export async function withWriterLock<T>(
  operation: (context: WriterContext) => Promise<T>,
  databaseUrl?: string,
): Promise<T> {
  if (hostedMode()) {
    const configuration = storageConfiguration(databaseUrl);
    if (configuration.backend === 'postgres')
      return withPostgresWriter(configuration.connectionString, postgres => operation({ postgres }));
  }
  const lock = await acquireWriterLock(databaseUrl);
  try {
    return await operation({ databasePath: lock.databasePath });
  } finally {
    await lock.release();
  }
}

export class WriterBusyError extends Error {
  readonly lockPath: string;
  constructor(lockPath: string) {
    super(`Knowledge writer lock is held: ${lockPath}. Retry after the writer exits.`);
    this.name = 'WriterBusyError';
    this.lockPath = lockPath;
  }
}

/** Acquire the sidecar lock for a LibSQL writer. */
export async function acquireWriterLock(databaseUrl?: string) {
  let databasePath: string;
  let lockPath: string;
  if (hostedMode()) {
    const configuration = storageConfiguration(databaseUrl);
    if (configuration.backend === 'postgres') throw new Error('Use withWriterLock for PostgreSQL writes');
    const configured = process.env.SUPPORT_WRITER_LOCK_FILE;
    if (!configured || !isAbsolute(configured))
      throw new Error('Hosted mode requires an absolute SUPPORT_WRITER_LOCK_FILE on the shared POSIX volume');
    lockPath = await canonicalDatabasePath(databaseUrlForPath(configured));
    databasePath = databaseUrl ?? process.env.SUPPORT_DATABASE_URL ?? '';
  } else {
    databasePath = await canonicalDatabasePath(databaseUrl);
    lockPath = `${databasePath}.writer.sqlite`;
  }
  await mkdir(dirname(lockPath), { recursive: true, mode: 0o700 });
  // SQLite holds an OS lock on a stable sidecar, separate from the Knowledge store's transactions.
  // Closing the connection or exiting the process releases it. Leave the sidecar in place.
  const connection = new DatabaseSync(lockPath);
  try {
    connection.exec('BEGIN IMMEDIATE');
  } catch (error) {
    connection.close();
    if ((error as { errcode?: number }).errcode === 5) throw new WriterBusyError(lockPath); // SQLITE_BUSY
    throw error;
  }
  return { databasePath, lockPath, release: () => connection.close() };
}
