import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { canonicalDatabasePath } from '../database.ts';

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
  const databasePath = await canonicalDatabasePath(databaseUrl);
  const lockPath = `${databasePath}.writer.sqlite`;
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
