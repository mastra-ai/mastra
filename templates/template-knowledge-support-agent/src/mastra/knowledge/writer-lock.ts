import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Client, DatabaseError, type Pool } from 'pg';
import type { DbClient, TxClient } from '@mastra/pg';
import { canonicalDatabasePath, databaseUrlForPath } from '../database/database-file.ts';
import { resolveStoreConfiguration, type StoreConfiguration } from '../database/store.ts';

// PostgreSQL advisory locks are database-scoped. Keep these namespace keys stable across workers and releases.
const postgresWriterKey = [0x4b534147, 0x57524954];
const postgresDeadlineMs = 10_000;

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
  readonly commitState: 'not-committed' | 'unknown';

  constructor(cause: unknown, commitState: 'not-committed' | 'unknown') {
    super('PostgreSQL writer session was lost', { cause });
    this.name = 'WriterSessionLostError';
    this.commitState = commitState;
  }
}

async function withPostgresWriter<T>(connectionString: string, operation: (client: DbClient) => Promise<T>) {
  const connection = new Client({ connectionString, connectionTimeoutMillis: postgresDeadlineMs });
  let connectionError: Error | undefined;
  connection.on('error', error => {
    connectionError ??= error;
  });
  const client = writerClient(async (sql, values) => {
    if (connectionError) throw new WriterSessionLostError(connectionError, 'not-committed');
    const committing = sql === 'COMMIT';
    const deadline = setTimeout(() => {
      connectionError = new Error('PostgreSQL writer query deadline elapsed');
      connection.connection.stream.destroy();
    }, postgresDeadlineMs);
    try {
      return await connection.query(sql, values);
    } catch (error) {
      if (connectionError) throw new WriterSessionLostError(connectionError, committing ? 'unknown' : 'not-committed');
      // A server rejection gives a definite result. A fatal protocol or transport failure can
      // arrive before pg emits its client error event, so treat an in-flight COMMIT as unknown.
      if (committing && (!(error instanceof DatabaseError) || error.severity === 'FATAL' || error.severity === 'PANIC'))
        throw new WriterSessionLostError(error, 'unknown');
      throw error;
    } finally {
      clearTimeout(deadline);
    }
  });
  let connected = false;
  try {
    await connection.connect();
    connected = true;
    await client.none('BEGIN');
    await client.none(`SET LOCAL lock_timeout = '5s';
      SET LOCAL statement_timeout = '30s';
      SET LOCAL idle_in_transaction_session_timeout = '60s'`);
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
    if (connected && !connectionError && !(error instanceof WriterSessionLostError))
      await client.none('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    const deadline = setTimeout(() => connection.connection.stream.destroy(), postgresDeadlineMs);
    try {
      await connection.end();
    } finally {
      clearTimeout(deadline);
    }
  }
}

type LibSQLConfiguration = Extract<StoreConfiguration, { backend: 'libsql' }>;
export type WriterContext = { libsql: LibSQLConfiguration; postgres?: never } | { libsql?: never; postgres: DbClient };

export async function withWriterLock<T>(
  operation: (context: WriterContext) => Promise<T>,
  databaseUrl?: string,
): Promise<T> {
  const configuration = resolveStoreConfiguration(process.env, databaseUrl);
  if (configuration.backend === 'postgres')
    return withPostgresWriter(configuration.connectionString, postgres => operation({ postgres }));
  const lock = await acquireLibSQLWriterLock(configuration);
  try {
    return await operation({ libsql: { ...configuration, url: lock.url } });
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
  const configuration = resolveStoreConfiguration(process.env, databaseUrl);
  if (configuration.backend === 'postgres') throw new Error('Use withWriterLock for PostgreSQL writes');
  return acquireLibSQLWriterLock(configuration);
}

async function acquireLibSQLWriterLock(configuration: LibSQLConfiguration) {
  const databasePath = configuration.lockFile ? undefined : await canonicalDatabasePath(configuration.url);
  const lockPath = configuration.lockFile
    ? await canonicalDatabasePath(databaseUrlForPath(configuration.lockFile))
    : `${databasePath}.writer.sqlite`;
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
  return {
    databasePath,
    lockPath,
    url: databasePath ? databaseUrlForPath(databasePath) : configuration.url,
    release: () => connection.close(),
  };
}
