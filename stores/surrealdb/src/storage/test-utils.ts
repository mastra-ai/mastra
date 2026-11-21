import { Surreal } from 'surrealdb';
import type { SurrealDBStoreConfig } from './index';

export const SURREALDB_URL = process.env.SURREALDB_URL || 'ws://localhost:8010';

/** A config for a fresh database, so test files never share data. */
export function testConfig(database: string, overrides: Partial<SurrealDBStoreConfig> = {}): SurrealDBStoreConfig {
  return {
    id: `surrealdb-test-${database}`,
    url: SURREALDB_URL,
    username: process.env.SURREALDB_USERNAME || 'root',
    password: process.env.SURREALDB_PASSWORD || 'root',
    namespace: process.env.SURREALDB_NAMESPACE || 'mastra_test',
    database,
    ...overrides,
  } as SurrealDBStoreConfig;
}

/** An already connected and authenticated client, as a user would pass with `db`. */
export async function connectedClient(database: string): Promise<Surreal> {
  const db = new Surreal();
  await db.connect(SURREALDB_URL, {
    authentication: {
      username: process.env.SURREALDB_USERNAME || 'root',
      password: process.env.SURREALDB_PASSWORD || 'root',
    },
  });
  const namespace = process.env.SURREALDB_NAMESPACE || 'mastra_test';
  await db.query(
    `DEFINE NAMESPACE IF NOT EXISTS ${namespace}; USE NS ${namespace}; DEFINE DATABASE IF NOT EXISTS ${database};`,
  );
  await db.use({ namespace, database });
  return db;
}
