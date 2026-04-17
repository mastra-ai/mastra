import type { ClickHouseClient } from '@clickhouse/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { IMastraLogger } from '@mastra/core/logger';
import { createStorageErrorId } from '@mastra/core/storage';

import {
  TABLE_METRIC_EVENTS,
  TABLE_LOG_EVENTS,
  TABLE_SCORE_EVENTS,
  TABLE_FEEDBACK_EVENTS,
  METRIC_EVENTS_DDL,
  LOG_EVENTS_DDL,
  SCORE_EVENTS_DDL,
  FEEDBACK_EVENTS_DDL,
} from './ddl';

interface SignalMigration {
  table: string;
  createDDL: string;
  idColumn: string;
}

const SIGNAL_MIGRATIONS: SignalMigration[] = [
  { table: TABLE_METRIC_EVENTS, createDDL: METRIC_EVENTS_DDL, idColumn: 'metricId' },
  { table: TABLE_LOG_EVENTS, createDDL: LOG_EVENTS_DDL, idColumn: 'logId' },
  { table: TABLE_SCORE_EVENTS, createDDL: SCORE_EVENTS_DDL, idColumn: 'scoreId' },
  { table: TABLE_FEEDBACK_EVENTS, createDDL: FEEDBACK_EVENTS_DDL, idColumn: 'feedbackId' },
];

async function getTableEngine(client: ClickHouseClient, table: string): Promise<string | null> {
  const result = await client.query({
    query: `SELECT engine FROM system.tables WHERE database = currentDatabase() AND name = {table:String}`,
    query_params: { table },
    format: 'JSONEachRow',
  });
  const rows = (await result.json()) as Array<{ engine: string }>;
  return rows[0]?.engine ?? null;
}

async function getTableColumns(client: ClickHouseClient, table: string): Promise<string[]> {
  const result = await client.query({ query: `DESCRIBE TABLE ${table}`, format: 'JSONEachRow' });
  const rows = (await result.json()) as Array<{ name: string }>;
  return rows.map(r => r.name);
}

/**
 * Migrate signal tables from MergeTree to ReplacingMergeTree without dropping data.
 * Copy-and-swap: rename → create new → INSERT…SELECT (generating IDs) → drop backup.
 * On failure the original table is restored from the backup. Idempotent.
 */
export async function migrateSignalTables(client: ClickHouseClient, logger?: IMastraLogger): Promise<void> {
  for (const { table, createDDL, idColumn } of SIGNAL_MIGRATIONS) {
    const engine = await getTableEngine(client, table);
    if (!engine || engine === 'ReplacingMergeTree') continue;

    logger?.info?.(`Migrating ${table} from ${engine} to ReplacingMergeTree with ${idColumn} column`);

    const backup = `${table}_backup_${Date.now()}`;

    try {
      await client.command({ query: `RENAME TABLE ${table} TO ${backup}` });
      await client.command({ query: createDDL });

      const newColumns = await getTableColumns(client, table);
      const backupColumns = new Set(await getTableColumns(client, backup));

      const columnList = newColumns.map(c => `"${c}"`).join(', ');
      const selectExprs = newColumns
        .map(c => {
          if (c === idColumn) {
            return backupColumns.has(c)
              ? `COALESCE(nullIf("${c}", ''), toString(generateUUIDv4())) AS "${c}"`
              : `toString(generateUUIDv4()) AS "${c}"`;
          }
          return backupColumns.has(c) ? `"${c}"` : `NULL AS "${c}"`;
        })
        .join(', ');

      await client.command({
        query: `INSERT INTO ${table} (${columnList}) SELECT ${selectExprs} FROM ${backup}`,
      });
      await client.command({ query: `DROP TABLE ${backup}` });

      logger?.info?.(`Successfully migrated ${table}`);
    } catch (error) {
      logger?.error?.(`Migration of ${table} failed: ${(error as Error).message}`);
      try {
        const backupEngine = await getTableEngine(client, backup);
        const currentEngine = await getTableEngine(client, table);
        if (backupEngine && !currentEngine) {
          logger?.info?.(`Restoring ${table} from ${backup}`);
          await client.command({ query: `RENAME TABLE ${backup} TO ${table}` });
        } else if (backupEngine && currentEngine) {
          logger?.info?.(`Dropping partial ${table} and restoring from ${backup}`);
          await client.command({ query: `DROP TABLE IF EXISTS ${table}` });
          await client.command({ query: `RENAME TABLE ${backup} TO ${table}` });
        }
      } catch (restoreError) {
        logger?.error?.(`Failed to restore ${table} from backup: ${(restoreError as Error).message}`);
      }
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'MIGRATE_SIGNAL_TABLES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { table, idColumn },
        },
        error,
      );
    }
  }
}
