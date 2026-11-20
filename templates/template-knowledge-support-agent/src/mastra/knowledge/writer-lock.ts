import { mkdir } from 'node:fs/promises';
import { dirname, isAbsolute } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Client } from 'pg';
import { canonicalDatabasePath, hostedMode, databaseUrlForPath, storageConfiguration } from '../database.ts';

// PostgreSQL advisory locks are database-scoped. Keep these namespace keys stable across workers and releases.
const postgresWriterKey = [0x4b534147, 0x57524954];

async function acquirePostgresWriterLock(connectionString: string) {
  const connection = new Client({ connectionString, connectionTimeoutMillis: 10000 });
  let connectionError: Error | undefined;
  // A disconnected session releases its lock at the server. Observe errors even while no query is active.
  connection.on('error', error => {
    connectionError = error;
  });
  try {
    await connection.connect();
    const result = await connection.query('SELECT pg_try_advisory_lock($1, $2) AS acquired', postgresWriterKey);
    if (!result.rows[0]?.acquired) throw new WriterBusyError('PostgreSQL support writer');
  } catch (error) {
    await connection.end();
    throw error;
  }
  let released = false;
  return {
    databasePath: 'postgres',
    lockPath: 'PostgreSQL support writer',
    async release() {
      if (released) return;
      released = true;
      try {
        if (connectionError) throw new Error('PostgreSQL writer lock connection was lost', { cause: connectionError });
        const result = await connection.query('SELECT pg_advisory_unlock($1, $2) AS released', postgresWriterKey);
        if (!result.rows[0]?.released) throw new Error('PostgreSQL writer session no longer owns its lock');
      } finally {
        await connection.end();
      }
    },
  };
}

export class WriterBusyError extends Error {
  readonly lockPath: string;
  constructor(lockPath: string) {
    super(`Knowledge writer lock is held: ${lockPath}. Retry after the writer exits.`);
    this.name = 'WriterBusyError';
    this.lockPath = lockPath;
  }
}

/** All privileged writers must hold this lock around reads and writes. */
export async function acquireWriterLock(databaseUrl?: string) {
  let databasePath: string;
  let lockPath: string;
  if (hostedMode()) {
    const configuration = storageConfiguration(databaseUrl);
    if (configuration.backend === 'postgres') return acquirePostgresWriterLock(configuration.connectionString);
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
