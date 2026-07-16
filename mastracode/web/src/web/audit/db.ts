/**
 * Database readiness for the audit-events table. Reuses the shared
 * application Postgres (`../github/db`) and runs the idempotent DDL once per
 * process, mirroring `ensureFactoryDbReady`.
 */

import { sql } from 'drizzle-orm';
import { getAppDb } from '../github/db';
import { AUDIT_MIGRATION_SQL } from './schema';

let migrationPromise: Promise<void> | undefined;

/** Run the idempotent audit-events migrations once. Safe to call repeatedly. */
export async function ensureAuditDbReady(): Promise<void> {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    await getAppDb().execute(sql.raw(AUDIT_MIGRATION_SQL));
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
export function __resetAuditDbForTests(): void {
  migrationPromise = undefined;
}
