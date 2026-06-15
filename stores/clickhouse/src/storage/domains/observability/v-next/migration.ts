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

export interface SignalMigrationStatusTable {
  table: string;
  engine: string;
  idColumn: string;
}

export interface SignalMigrationStatus {
  needsMigration: boolean;
  tables: SignalMigrationStatusTable[];
}

const SIGNAL_MIGRATIONS: SignalMigration[] = [
  { table: TABLE_METRIC_EVENTS, createDDL: METRIC_EVENTS_DDL, idColumn: 'metricId' },
  { table: TABLE_LOG_EVENTS, createDDL: LOG_EVENTS_DDL, idColumn: 'logId' },
  { table: TABLE_SCORE_EVENTS, createDDL: SCORE_EVENTS_DDL, idColumn: 'scoreId' },
  { table: TABLE_FEEDBACK_EVENTS, createDDL: FEEDBACK_EVENTS_DDL, idColumn: 'feedbackId' },
];

// ClickHouse Cloud silently rewrites `ReplacingMergeTree` to `SharedReplacingMergeTree`,
// and self-managed replicated clusters rewrite it to `ReplicatedReplacingMergeTree`.
// All three share dedup-on-merge semantics, so treat them as already-migrated.
export function isReplacingMergeTreeEngine(engine: string): boolean {
  return engine.endsWith('ReplacingMergeTree');
}

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

function buildTemporaryTableDDL(createDDL: string, table: string, tempTable: string): string {
  return createDDL.replace(`CREATE TABLE IF NOT EXISTS ${table}`, `CREATE TABLE ${tempTable}`);
}

async function dropTableIfExists(client: ClickHouseClient, table: string): Promise<void> {
  if ((await getTableEngine(client, table)) !== null) {
    await client.command({ query: `DROP TABLE ${table}` });
  }
}

function createMigrationError(args: { table: string; idColumn: string }, error: unknown): MastraError {
  return new MastraError(
    {
      id: createStorageErrorId('CLICKHOUSE', 'MIGRATE_SIGNAL_TABLES', 'FAILED'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
      details: args,
    },
    error,
  );
}

export async function checkSignalTablesMigrationStatus(client: ClickHouseClient): Promise<SignalMigrationStatus> {
  const tables: SignalMigrationStatusTable[] = [];

  for (const { table, idColumn } of SIGNAL_MIGRATIONS) {
    const engine = await getTableEngine(client, table);
    if (!engine || isReplacingMergeTreeEngine(engine)) {
      continue;
    }

    tables.push({ table, engine, idColumn });
  }

  return {
    needsMigration: tables.length > 0,
    tables,
  };
}

/**
 * Migrate signal tables from MergeTree to ReplacingMergeTree without dropping data.
 * Copy-and-swap: create temp → INSERT…SELECT (generating IDs) → EXCHANGE temp with live
 * → drop old data. EXCHANGE swaps the two table names atomically, so concurrent
 * writers never observe a missing table.
 */
export async function migrateSignalTables(client: ClickHouseClient, logger?: IMastraLogger): Promise<void> {
  for (const { table, createDDL, idColumn } of SIGNAL_MIGRATIONS) {
    const engine = await getTableEngine(client, table);
    if (!engine || isReplacingMergeTreeEngine(engine)) continue;

    logger?.info?.(`Migrating ${table} from ${engine} to ReplacingMergeTree with ${idColumn} column`);

    const temp = `${table}_migrating_${Date.now()}`;

    try {
      await client.command({ query: buildTemporaryTableDDL(createDDL, table, temp) });

      const newColumns = await getTableColumns(client, temp);
      const currentColumns = new Set(await getTableColumns(client, table));

      const columnList = newColumns.map(c => `"${c}"`).join(', ');
      const selectExprs = newColumns
        .map(c => {
          if (c === idColumn) {
            return currentColumns.has(c)
              ? `COALESCE(nullIf("${c}", ''), toString(generateUUIDv4())) AS "${c}"`
              : `toString(generateUUIDv4()) AS "${c}"`;
          }
          return currentColumns.has(c) ? `"${c}"` : `NULL AS "${c}"`;
        })
        .join(', ');

      await client.command({
        query: `INSERT INTO ${temp} (${columnList}) SELECT ${selectExprs} FROM ${table}`,
      });

      await client.command({ query: `EXCHANGE TABLES ${temp} AND ${table}` });
      await client.command({ query: `DROP TABLE ${temp}` });

      logger?.info?.(`Successfully migrated ${table}`);
    } catch (error) {
      logger?.error?.(`Migration of ${table} failed: ${(error as Error).message}`);
      try {
        await dropTableIfExists(client, temp);
      } catch (restoreError) {
        logger?.error?.(`Failed to clean up temporary table ${temp}: ${(restoreError as Error).message}`);
      }
      throw createMigrationError({ table, idColumn }, error);
    }
  }
}
