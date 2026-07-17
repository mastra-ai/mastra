/**
 * Application database bridge for the GitHub App + Linear integrations.
 *
 * TEMPORARY: github/linear are the last app-table consumers still on drizzle.
 * The drizzle client here no longer owns a connection — it is built over the
 * shared pg pool of the storage instance injected into `MastraFactory`
 * (`getSharedAppPool()`), so Mastra storage and the app tables ride one pool.
 * The integrations PR ports github/linear to `FactoryStorageDomain` classes
 * and deletes this module together with the drizzle dependency.
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type pg from 'pg';
import { getSharedAppPool } from '../runtime-config';
import { MIGRATION_SQL } from './schema';
import * as schema from './schema';

export type AppDb = NodePgDatabase<typeof schema>;

let boundPool: pg.Pool | undefined;
let db: AppDb | undefined;
let migrationPromise: Promise<void> | undefined;

/**
 * True when the app database is available: the factory was configured with a
 * `PostgresStore` whose pool the app tables share. Required for the GitHub
 * feature.
 */
export function isAppDbConfigured(): boolean {
  return Boolean(getSharedAppPool());
}

/**
 * Get the drizzle client bound to the shared app pool (rebuilt if the seeded
 * storage changed, e.g. across test seeds).
 * @throws if the factory has no pg-backed storage.
 */
export function getAppDb(): AppDb {
  const pool = getSharedAppPool();
  if (!pool) {
    throw new Error(
      'No Postgres storage configured; the GitHub App feature requires the MastraFactory `storage` slot to be a PostgresStore.',
    );
  }
  if (!db || boundPool !== pool) {
    boundPool = pool;
    db = drizzle(pool, { schema });
    migrationPromise = undefined;
  }
  return db;
}

/**
 * Run the idempotent migrations once. Safe to call repeatedly; the underlying
 * work runs at most once per process. Throws if the database is unreachable so
 * the caller can fail soft (disable the feature) rather than crash.
 */
export async function ensureAppDbReady(): Promise<void> {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    const client = getAppDb();
    await client.execute(sql.raw(MIGRATION_SQL));
  })();
  try {
    await migrationPromise;
  } catch (err) {
    // Reset so a later retry can attempt again.
    migrationPromise = undefined;
    throw err;
  }
}

/**
 * The shared pg `Pool`. Used by the distributed project lock, which needs a
 * single dedicated connection to hold a transaction-scoped advisory lock.
 * @throws if the factory has no pg-backed storage.
 */
export function getAppDbPool(): pg.Pool {
  getAppDb();
  return boundPool!;
}
