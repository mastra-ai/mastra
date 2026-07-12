/**
 * Database readiness for the intake settings table. Reuses the shared
 * application Postgres (`../github/db`) and runs the idempotent DDL once per
 * process, mirroring `ensureAppDbReady` / `ensureLinearDbReady`.
 */

import { sql } from 'drizzle-orm';
import { getAppDb } from '../github/db';
import { INTAKE_MIGRATION_SQL } from './store';

let migrationPromise: Promise<void> | undefined;

/** Run the idempotent intake migrations once. Safe to call repeatedly. */
export async function ensureIntakeDbReady(): Promise<void> {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    await getAppDb().execute(sql.raw(INTAKE_MIGRATION_SQL));
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
export function __resetIntakeDbForTests(): void {
  migrationPromise = undefined;
}
