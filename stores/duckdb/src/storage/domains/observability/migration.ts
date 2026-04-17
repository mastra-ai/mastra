/**
 * Non-destructive migration for signal tables.
 *
 * Older versions created metric_events / log_events / score_events / feedback_events
 * without a signal-ID column and therefore without a PRIMARY KEY on that column.
 * DuckDB cannot add a PRIMARY KEY (or NOT NULL) to an existing table that already
 * contains rows which do not satisfy the constraint, so each affected table is
 * migrated with a copy-and-swap:
 *
 *   1. ALTER TABLE <table> RENAME TO <table>_backup_<ts>
 *   2. CREATE TABLE <table> (new schema with PRIMARY KEY + NOT NULL signal ID)
 *   3. INSERT INTO <table> SELECT ... FROM <backup>
 *      — columns present in backup are copied through
 *      — the signal-ID column is generated fresh (uuid()) since the old schema
 *        did not have it
 *      — columns missing from backup are written as NULL
 *   4. DROP TABLE <backup>
 *
 * On any error the original data is restored from the backup so no rows are lost.
 */
import type { DuckDBConnection } from '../../db/index';

import { METRIC_EVENTS_DDL, LOG_EVENTS_DDL, SCORE_EVENTS_DDL, FEEDBACK_EVENTS_DDL } from './ddl';

interface SignalMigration {
  table: string;
  createDDL: string;
  idColumn: string;
}

const SIGNAL_MIGRATIONS: SignalMigration[] = [
  { table: 'metric_events', createDDL: METRIC_EVENTS_DDL, idColumn: 'metricId' },
  { table: 'log_events', createDDL: LOG_EVENTS_DDL, idColumn: 'logId' },
  { table: 'score_events', createDDL: SCORE_EVENTS_DDL, idColumn: 'scoreId' },
  { table: 'feedback_events', createDDL: FEEDBACK_EVENTS_DDL, idColumn: 'feedbackId' },
];

async function tableExists(db: DuckDBConnection, table: string): Promise<boolean> {
  const rows = await db.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_name = ?`,
    [table],
  );
  return rows.length > 0;
}

async function hasPrimaryKey(db: DuckDBConnection, table: string): Promise<boolean> {
  const rows = await db.query<{ constraint_type: string }>(
    `SELECT constraint_type FROM information_schema.table_constraints
     WHERE table_name = ? AND constraint_type = 'PRIMARY KEY'`,
    [table],
  );
  return rows.length > 0;
}

async function getColumns(db: DuckDBConnection, table: string): Promise<string[]> {
  const rows = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = ?`,
    [table],
  );
  return rows.map(r => r.column_name);
}

/**
 * Migrate signal tables to a schema with PRIMARY KEY + NOT NULL on the signal ID
 * without dropping data. Idempotent: tables that already have the primary key
 * (or do not exist yet) are skipped.
 */
export async function migrateSignalTables(db: DuckDBConnection): Promise<void> {
  for (const { table, createDDL, idColumn } of SIGNAL_MIGRATIONS) {
    if (!(await tableExists(db, table))) continue;
    if (await hasPrimaryKey(db, table)) continue;

    const backup = `${table}_backup_${Date.now()}`;

    try {
      // Step 1: rename old table out of the way.
      await db.execute(`ALTER TABLE ${table} RENAME TO ${backup}`);

      // Step 2: create the new table with PRIMARY KEY + NOT NULL signal ID.
      await db.execute(createDDL);

      // Step 3: copy data, generating signal IDs for every row (old schema
      // did not carry the ID column) and filling absent columns with NULL.
      const newColumns = await getColumns(db, table);
      const backupColumns = new Set(await getColumns(db, backup));

      const columnList = newColumns.map(c => `"${c}"`).join(', ');
      const selectExprs = newColumns
        .map(c => {
          if (c === idColumn) {
            // uuid() returns a UUID on every call so each row gets a unique id
            // even when the backup has no signal-ID column. Cast to VARCHAR to
            // match the new table's column type.
            return backupColumns.has(c)
              ? `COALESCE(NULLIF("${c}", ''), CAST(uuid() AS VARCHAR)) AS "${c}"`
              : `CAST(uuid() AS VARCHAR) AS "${c}"`;
          }
          return backupColumns.has(c) ? `"${c}"` : `NULL AS "${c}"`;
        })
        .join(', ');

      await db.execute(`INSERT INTO ${table} (${columnList}) SELECT ${selectExprs} FROM ${backup}`);

      // Step 4: drop the backup once the copy succeeded.
      await db.execute(`DROP TABLE ${backup}`);
    } catch (error) {
      // Best-effort restore so the original data is not lost on failure.
      try {
        const newExists = await tableExists(db, table);
        const backupExists = await tableExists(db, backup);
        if (!newExists && backupExists) {
          await db.execute(`ALTER TABLE ${backup} RENAME TO ${table}`);
        } else if (newExists && backupExists) {
          await db.execute(`DROP TABLE IF EXISTS ${table}`);
          await db.execute(`ALTER TABLE ${backup} RENAME TO ${table}`);
        }
      } catch {
        // Swallow restore errors so the original failure is surfaced.
      }
      throw error;
    }
  }
}
