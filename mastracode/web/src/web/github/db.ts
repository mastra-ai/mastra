/**
 * Application database layer for the GitHub App integration.
 *
 * This is a *separate* Postgres from Mastra's own storage: it is created lazily
 * from `APP_DATABASE_URL` and holds only the GitHub installations/projects
 * tables defined in `./schema`. The connection is a singleton so the whole
 * process shares one pg Pool.
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import { MIGRATION_SQL } from './schema';
import * as schema from './schema';

const { Pool } = pkg;

export type AppDb = NodePgDatabase<typeof schema>;

let pool: pkg.Pool | undefined;
let db: AppDb | undefined;
let migrationPromise: Promise<void> | undefined;

/**
 * True when the app database is configured. Required for the GitHub feature.
 */
export function isAppDbConfigured(): boolean {
  return Boolean(process.env.APP_DATABASE_URL);
}

/**
 * Get (lazily creating) the Drizzle client bound to `APP_DATABASE_URL`.
 * @throws if `APP_DATABASE_URL` is not set.
 */
export function getAppDb(): AppDb {
  if (db) return db;
  const connectionString = process.env.APP_DATABASE_URL;
  if (!connectionString) {
    throw new Error('APP_DATABASE_URL is not set; the GitHub App feature requires an application database.');
  }
  pool = new Pool({ connectionString });
  db = drizzle(pool, { schema });
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
 * Get the underlying pg `Pool`, lazily creating the client if needed. Used by
 * the distributed project lock, which needs a single dedicated connection to
 * hold a transaction-scoped advisory lock.
 * @throws if `APP_DATABASE_URL` is not set.
 */
export function getAppDbPool(): pkg.Pool {
  getAppDb();
  if (!pool) {
    throw new Error('APP_DATABASE_URL is not set; the GitHub App feature requires an application database.');
  }
  return pool;
}

/**
 * Close the pool. Primarily for tests / graceful shutdown.
 */
export async function closeAppDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    db = undefined;
    migrationPromise = undefined;
  }
}
