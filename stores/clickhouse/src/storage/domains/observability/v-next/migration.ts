/**
 * Non-destructive migration for signal tables.
 *
 * Older versions created metric_events / log_events / score_events / feedback_events
 * with `ENGINE = MergeTree` and no signal-ID column. This PR changes those tables
 * to `ENGINE = ReplacingMergeTree` with a required signal-ID column in ORDER BY.
 *
 * The engine and ORDER BY cannot be altered in place, so each table that is still
 * on the old engine is migrated with a copy-and-swap:
 *
 *   1. RENAME TABLE <table> TO <table>_backup_<ts>
 *   2. CREATE TABLE <table> (new schema)
 *   3. INSERT INTO <table> SELECT ... FROM <backup>
 *      — columns present in backup are copied through
 *      — the signal-ID column is generated fresh (generateUUIDv4) since the
 *        old schema did not have it
 *      — columns missing from backup are written as NULL
 *   4. DROP TABLE <backup>
 *
 * On any error the original data is restored from the backup so no rows are lost.
 */
import type { ClickHouseClient } from '@clickhouse/client';

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
  const result = await client.query({
    query: `DESCRIBE TABLE ${table}`,
    format: 'JSONEachRow',
  });
  const rows = (await result.json()) as Array<{ name: string }>;
  return rows.map(r => r.name);
}

/**
 * Migrate signal tables from MergeTree to ReplacingMergeTree without dropping data.
 * Idempotent: tables already on ReplacingMergeTree (or missing entirely) are skipped.
 */
export async function migrateSignalTables(client: ClickHouseClient): Promise<void> {
  for (const { table, createDDL, idColumn } of SIGNAL_MIGRATIONS) {
    const engine = await getTableEngine(client, table);
    // Missing table → CREATE TABLE IF NOT EXISTS later will make it fresh.
    // Already on ReplacingMergeTree → nothing to do.
    if (!engine || engine === 'ReplacingMergeTree') continue;

    const backup = `${table}_backup_${Date.now()}`;

    try {
      // Step 1: rename old table out of the way.
      await client.command({ query: `RENAME TABLE ${table} TO ${backup}` });

      // Step 2: create the new table with the correct engine and ORDER BY.
      await client.command({ query: createDDL });

      // Step 3: copy data, generating signal IDs for every row (old schema
      // did not carry the ID column) and filling absent columns with NULL.
      const newColumns = await getTableColumns(client, table);
      const backupColumns = new Set(await getTableColumns(client, backup));

      const columnList = newColumns.map(c => `"${c}"`).join(', ');
      const selectExprs = newColumns
        .map(c => {
          if (c === idColumn) {
            // Generate a fresh id when the backup lacks the column, otherwise
            // keep the existing non-empty value and fall back to a new UUID.
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

      // Step 4: drop the backup once the copy succeeded.
      await client.command({ query: `DROP TABLE ${backup}` });
    } catch (error) {
      // Best-effort restore so the original data is not lost on failure.
      try {
        const backupEngine = await getTableEngine(client, backup);
        const currentEngine = await getTableEngine(client, table);
        if (backupEngine && !currentEngine) {
          // New table never got created; just swap the backup back into place.
          await client.command({ query: `RENAME TABLE ${backup} TO ${table}` });
        } else if (backupEngine && currentEngine) {
          // Partial new table exists; drop it and restore the backup.
          await client.command({ query: `DROP TABLE IF EXISTS ${table}` });
          await client.command({ query: `RENAME TABLE ${backup} TO ${table}` });
        }
      } catch {
        // Swallow restore errors so the original failure is surfaced.
      }
      throw error;
    }
  }
}
