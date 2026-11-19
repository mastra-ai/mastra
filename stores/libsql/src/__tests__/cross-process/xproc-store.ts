/**
 * The store a cross-process cell runs on: the env's shared LibSQL file, or one
 * Postgres schema that every process of the cell opens. Postgres has workflow
 * step guards, which change how evented workflow events are routed between
 * processes.
 */
import type { MastraCompositeStore } from '@mastra/core/storage';

import { LibSQLStore } from '../../storage';

export type XprocStore = { kind: 'libsql' } | { kind: 'pg'; connectionString: string; schemaName: string };

export async function openXprocStore(store: XprocStore, id: string, dbUrl: string): Promise<MastraCompositeStore> {
  if (store.kind === 'libsql') return new LibSQLStore({ id, url: dbUrl });
  const { PostgresStore } = await import('@mastra/pg');
  return new PostgresStore({ id, connectionString: store.connectionString, schemaName: store.schemaName });
}

/** Drops the cell's Postgres schema; a no-op for LibSQL, whose file goes with the env. */
export async function dropXprocStore(store: XprocStore): Promise<void> {
  if (store.kind === 'libsql') return;
  const { PostgresStore } = await import('@mastra/pg');
  const admin = new PostgresStore({ id: 'xproc-drop', connectionString: store.connectionString });
  try {
    await admin.db.none(`DROP SCHEMA IF EXISTS "${store.schemaName}" CASCADE`);
  } finally {
    await admin.close();
  }
}
