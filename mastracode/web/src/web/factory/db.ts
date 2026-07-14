/**
 * Database readiness for the Factory work-items table. Reuses the shared
 * application Postgres (`../github/db`) and runs the idempotent DDL once per
 * process, mirroring `ensureAppDbReady` / `ensureIntakeDbReady`.
 */

import { sql } from 'drizzle-orm';
import { getAppDb } from '../github/db';
import { FACTORY_MIGRATION_SQL } from './schema';

let migrationPromise: Promise<void> | undefined;

/** Run the idempotent work-items migrations once. Safe to call repeatedly. */
export async function ensureFactoryDbReady(): Promise<void> {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    await getAppDb().execute(sql.raw(FACTORY_MIGRATION_SQL));
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
export function __resetFactoryDbForTests(): void {
  migrationPromise = undefined;
}
