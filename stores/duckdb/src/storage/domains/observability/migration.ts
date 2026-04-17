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
 * without dropping data. Copy-and-swap: rename → create new → INSERT…SELECT
 * (generating IDs) → drop backup. On failure the original table is restored
 * from the backup. Idempotent.
 */
export async function migrateSignalTables(db: DuckDBConnection): Promise<void> {
  for (const { table, createDDL, idColumn } of SIGNAL_MIGRATIONS) {
    if (!(await tableExists(db, table))) continue;
    if (await hasPrimaryKey(db, table)) continue;

    const backup = `${table}_backup_${Date.now()}`;

    try {
      await db.execute(`ALTER TABLE ${table} RENAME TO ${backup}`);
      await db.execute(createDDL);

      const newColumns = await getColumns(db, table);
      const backupColumns = new Set(await getColumns(db, backup));

      const columnList = newColumns.map(c => `"${c}"`).join(', ');
      const selectExprs = newColumns
        .map(c => {
          if (c === idColumn) {
            return backupColumns.has(c)
              ? `COALESCE(NULLIF("${c}", ''), CAST(uuid() AS VARCHAR)) AS "${c}"`
              : `CAST(uuid() AS VARCHAR) AS "${c}"`;
          }
          return backupColumns.has(c) ? `"${c}"` : `NULL AS "${c}"`;
        })
        .join(', ');

      await db.execute(`INSERT INTO ${table} (${columnList}) SELECT ${selectExprs} FROM ${backup}`);
      await db.execute(`DROP TABLE ${backup}`);
    } catch (error) {
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
