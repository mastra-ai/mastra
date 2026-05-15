import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { IMastraLogger } from '@mastra/core/logger';
import { createStorageErrorId } from '@mastra/core/storage';

import type { DuckDBConnection } from '../../db/index';

import { METRIC_EVENTS_DDL, LOG_EVENTS_DDL, SCORE_EVENTS_DDL, FEEDBACK_EVENTS_DDL } from './ddl';

interface SignalMigration {
  table: string;
  createDDL: string;
  idColumn: string;
}

export interface SignalMigrationStatusTable {
  table: string;
  idColumn: string;
}

export interface SignalMigrationStatus {
  needsMigration: boolean;
  tables: SignalMigrationStatusTable[];
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

function buildTemporaryTableDDL(createDDL: string, table: string, tempTable: string): string {
  return createDDL.replace(`CREATE TABLE IF NOT EXISTS ${table}`, `CREATE TABLE ${tempTable}`);
}

async function dropTableIfExists(db: DuckDBConnection, table: string): Promise<void> {
  if (await tableExists(db, table)) {
    await db.execute(`DROP TABLE ${table}`);
  }
}

function createMigrationError(args: { table: string; idColumn: string }, error: unknown): MastraError {
  return new MastraError(
    {
      id: createStorageErrorId('DUCKDB', 'MIGRATE_SIGNAL_TABLES', 'FAILED'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
      details: args,
    },
    error,
  );
}

export async function checkSignalTablesMigrationStatus(db: DuckDBConnection): Promise<SignalMigrationStatus> {
  const tables: SignalMigrationStatusTable[] = [];

  for (const { table, idColumn } of SIGNAL_MIGRATIONS) {
    if (!(await tableExists(db, table))) {
      continue;
    }

    if (await hasPrimaryKey(db, table)) {
      continue;
    }

    tables.push({ table, idColumn });
  }

  return {
    needsMigration: tables.length > 0,
    tables,
  };
}

/**
 * Migrate signal tables to a schema with PRIMARY KEY + NOT NULL on the signal ID
 * without dropping data. Copy-and-swap: create temp → INSERT…SELECT
 * (generating IDs) → rename old to backup → rename temp to live → drop backup.
 * The live table is only touched during the final swap step.
 */
export async function migrateSignalTables(db: DuckDBConnection, logger?: IMastraLogger): Promise<void> {
  for (const { table, createDDL, idColumn } of SIGNAL_MIGRATIONS) {
    if (!(await tableExists(db, table))) continue;
    if (await hasPrimaryKey(db, table)) continue;

    logger?.info?.(`Migrating ${table} to schema with ${idColumn} PRIMARY KEY`);

    const temp = `${table}_migrating_${Date.now()}`;
    const backup = `${table}_backup_${Date.now()}`;
    let originalRenamed = false;
    let swapCompleted = false;

    try {
      await db.execute(buildTemporaryTableDDL(createDDL, table, temp));

      const newColumns = await getColumns(db, temp);
      const currentColumns = new Set(await getColumns(db, table));

      const columnList = newColumns.map(c => `"${c}"`).join(', ');
      const selectExprs = newColumns
        .map(c => {
          if (c === idColumn) {
            return currentColumns.has(c)
              ? `COALESCE(NULLIF("${c}", ''), CAST(uuid() AS VARCHAR)) AS "${c}"`
              : `CAST(uuid() AS VARCHAR) AS "${c}"`;
          }
          return currentColumns.has(c) ? `"${c}"` : `NULL AS "${c}"`;
        })
        .join(', ');

      await db.execute(`INSERT INTO ${temp} (${columnList}) SELECT ${selectExprs} FROM ${table}`);

      await db.execute(`ALTER TABLE ${table} RENAME TO ${backup}`);
      originalRenamed = true;
      await db.execute(`ALTER TABLE ${temp} RENAME TO ${table}`);
      swapCompleted = true;

      try {
        await db.execute(`DROP TABLE ${backup}`);
      } catch (cleanupError) {
        logger?.warn?.(
          `Migration of ${table} completed, but failed to drop backup ${backup}: ${(cleanupError as Error).message}`,
        );
      }

      logger?.info?.(`Successfully migrated ${table}`);
    } catch (error) {
      logger?.error?.(`Migration of ${table} failed: ${(error as Error).message}`);
      try {
        await dropTableIfExists(db, temp);
      } catch (restoreError) {
        logger?.error?.(`Failed to clean up temporary table ${temp}: ${(restoreError as Error).message}`);
      }
      if (originalRenamed && !swapCompleted) {
        try {
          await db.execute(`ALTER TABLE ${backup} RENAME TO ${table}`);
        } catch (restoreError) {
          logger?.error?.(
            `Failed to restore original table ${table} from backup ${backup}: ${(restoreError as Error).message}`,
          );
        }
      }
      throw createMigrationError({ table, idColumn }, error);
    }
  }
}
