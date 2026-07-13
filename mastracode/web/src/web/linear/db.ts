/**
 * Database readiness for the Linear integration. Reuses the shared application
 * Postgres (`../github/db`) and runs the Linear-specific idempotent DDL once
 * per process, mirroring `ensureAppDbReady`.
 */

import { sql } from 'drizzle-orm';
import { getAppDb } from '../github/db';
import { LINEAR_MIGRATION_SQL } from './schema';

let migrationPromise: Promise<void> | undefined;

/**
 * Run the idempotent Linear migrations once. Safe to call repeatedly; throws if
 * the database is unreachable so the caller can fail soft (disable the feature).
 */
export async function ensureLinearDbReady(): Promise<void> {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    await getAppDb().execute(sql.raw(LINEAR_MIGRATION_SQL));
  })();
  try {
    await migrationPromise;
  } catch (err) {
    // Reset so a later retry can attempt again.
    migrationPromise = undefined;
    throw err;
  }
}

/** For tests: reset the once-per-process migration latch. */
export function __resetLinearDbForTests(): void {
  migrationPromise = undefined;
}
