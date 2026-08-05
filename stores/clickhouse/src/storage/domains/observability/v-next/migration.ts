import type { ClickHouseClient } from '@clickhouse/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { IMastraLogger } from '@mastra/core/logger';
import { createStorageErrorId } from '@mastra/core/storage';

import {
  TABLE_METRIC_EVENTS,
  TABLE_LOG_EVENTS,
  TABLE_SCORE_EVENTS,
  TABLE_FEEDBACK_EVENTS,
  TABLE_SPAN_EVENTS,
  METRIC_EVENTS_DDL,
  LOG_EVENTS_DDL,
  SCORE_EVENTS_DDL,
  FEEDBACK_EVENTS_DDL,
  SPAN_EVENTS_DDL,
  TRACE_ROOTS_DDL,
  TRACE_ROOTS_MV_DDL,
  TRACE_BRANCHES_DDL,
  TRACE_BRANCHES_MV_DDL,
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

async function getTableColumnTypes(client: ClickHouseClient, table: string): Promise<Map<string, string>> {
  const result = await client.query({ query: `DESCRIBE TABLE ${table}`, format: 'JSONEachRow' });
  const rows = (await result.json()) as Array<{ name: string; type: string }>;
  return new Map(rows.map(r => [r.name, r.type]));
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
const TABLE_LEGACY_SPANS = 'mastra_ai_spans';

// Keys that have dedicated columns in the VNext schema and should be excluded from metadataSearch.
// Must stay in sync with PROMOTED_KEYS in helpers.ts.
const PROMOTED_METADATA_KEYS = [
  'experimentId',
  'entityType',
  'entityId',
  'entityName',
  'entityVersionId',
  'parentEntityVersionId',
  'rootEntityVersionId',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'environment',
  'executionSource',
  'serviceName',
] as const;

// ---------------------------------------------------------------------------
// Legacy span migration: mastra_ai_spans → mastra_span_events
// ---------------------------------------------------------------------------

export interface LegacySpanMigrationStatus {
  needsMigration: boolean;
}

const TABLE_LEGACY_MIGRATION_DONE = 'mastra_legacy_span_migration_done';

async function hasMarkerRow(client: ClickHouseClient): Promise<boolean> {
  const engine = await getTableEngine(client, TABLE_LEGACY_MIGRATION_DONE);
  if (!engine) return false;
  const result = await client.query({
    query: `SELECT count() as cnt FROM ${TABLE_LEGACY_MIGRATION_DONE}`,
    format: 'JSONEachRow',
  });
  const rows = (await result.json()) as Array<{ cnt: string | number }>;
  return Number(rows[0]?.cnt ?? 0) > 0;
}

export async function checkLegacySpanMigrationStatus(client: ClickHouseClient): Promise<LegacySpanMigrationStatus> {
  if (await hasMarkerRow(client)) {
    return { needsMigration: false };
  }

  const engine = await getTableEngine(client, TABLE_LEGACY_SPANS);
  if (!engine) {
    return { needsMigration: false };
  }

  const countResult = await client.query({
    query: `SELECT count() as cnt FROM ${TABLE_LEGACY_SPANS}`,
    format: 'JSONEachRow',
  });
  const countRows = (await countResult.json()) as Array<{ cnt: string | number }>;
  const legacyRowCount = Number(countRows[0]?.cnt ?? 0);

  if (legacyRowCount === 0) {
    return { needsMigration: false };
  }

  return { needsMigration: true };
}

// VNext target columns in DDL order, used for INSERT column list.
const VNEXT_SPAN_COLUMNS = [
  'dedupeKey',
  'traceId',
  'spanId',
  'parentSpanId',
  'experimentId',
  'entityType',
  'entityId',
  'entityName',
  'entityVersionId',
  'parentEntityVersionId',
  'parentEntityType',
  'parentEntityId',
  'parentEntityName',
  'rootEntityVersionId',
  'rootEntityType',
  'rootEntityId',
  'rootEntityName',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'environment',
  'executionSource',
  'serviceName',
  'name',
  'spanType',
  'isEvent',
  'startedAt',
  'endedAt',
  'tags',
  'metadataSearch',
  'attributes',
  'scope',
  'links',
  'input',
  'output',
  'error',
  'metadataRaw',
  'requestContext',
] as const;

/**
 * Build SELECT expressions that map legacy mastra_ai_spans columns to VNext mastra_span_events columns.
 * Handles missing columns (older schemas) by emitting NULL or default values.
 */
function buildLegacySpanSelectExprs(legacyColumnTypes: Map<string, string>): string {
  const has = (col: string) => legacyColumnTypes.has(col);
  const colOrNull = (legacy: string) => (has(legacy) ? `"${legacy}"` : 'NULL');

  const promotedIn = PROMOTED_METADATA_KEYS.map(k => `'${k}'`).join(', ');

  const metadataSearchExpr = has('metadata')
    ? `CAST(arrayFilter(x -> x.1 NOT IN (${promotedIn}) AND trim(BOTH ' ' FROM x.2) != '', arrayMap(x -> (x.1, trim(BOTH ' ' FROM x.2)), JSONExtractKeysAndValues(COALESCE("metadata", '{}'), 'String'))), 'Map(String, String)')`
    : `CAST(map(), 'Map(String, String)')`;

  // Legacy tables may store tags as Nullable(String) JSON or Array(String).
  let tagsExpr = '[]';
  if (has('tags')) {
    const tagsType = legacyColumnTypes.get('tags')!;
    if (tagsType.includes('Array')) {
      // Array(String) — trim, dedup, drop empty
      tagsExpr = `arrayFilter(x -> x != '', arrayDistinct(arrayMap(x -> trim(BOTH ' ' FROM x), "tags")))`;
    } else {
      // Nullable(String) JSON text — parse then trim, dedup, drop empty
      tagsExpr = `arrayFilter(x -> x != '', arrayDistinct(arrayMap(x -> trim(BOTH ' ' FROM x), JSONExtract(COALESCE("tags", '[]'), 'Array(String)'))))`;
    }
  }

  const exprs: Record<(typeof VNEXT_SPAN_COLUMNS)[number], string> = {
    dedupeKey: `concat("traceId", ':', "spanId")`,
    traceId: `"traceId"`,
    spanId: `"spanId"`,
    // Legacy stores '' for root spans; VNext MV filters on IS NULL.
    parentSpanId: has('parentSpanId') ? `nullIf("parentSpanId", '')` : 'NULL',
    experimentId: colOrNull('experimentId'),
    entityType: colOrNull('entityType'),
    entityId: colOrNull('entityId'),
    entityName: colOrNull('entityName'),
    entityVersionId: colOrNull('entityVersionId'),
    parentEntityVersionId: colOrNull('parentEntityVersionId'),
    parentEntityType: colOrNull('parentEntityType'),
    parentEntityId: colOrNull('parentEntityId'),
    parentEntityName: colOrNull('parentEntityName'),
    rootEntityVersionId: colOrNull('rootEntityVersionId'),
    rootEntityType: colOrNull('rootEntityType'),
    rootEntityId: colOrNull('rootEntityId'),
    rootEntityName: colOrNull('rootEntityName'),
    userId: colOrNull('userId'),
    organizationId: colOrNull('organizationId'),
    resourceId: colOrNull('resourceId'),
    runId: colOrNull('runId'),
    sessionId: colOrNull('sessionId'),
    threadId: colOrNull('threadId'),
    requestId: colOrNull('requestId'),
    environment: colOrNull('environment'),
    executionSource: has('source') ? `"source"` : 'NULL',
    serviceName: colOrNull('serviceName'),
    name: `"name"`,
    spanType: `"spanType"`,
    isEvent: `"isEvent"`,
    startedAt: `"startedAt"`,
    // VNext requires non-null endedAt; events always use startedAt.
    endedAt: `if("isEvent", "startedAt", COALESCE("endedAt", "startedAt"))`,
    tags: tagsExpr,
    metadataSearch: metadataSearchExpr,
    attributes: colOrNull('attributes'),
    scope: colOrNull('scope'),
    links: colOrNull('links'),
    input: colOrNull('input'),
    output: colOrNull('output'),
    error: colOrNull('error'),
    metadataRaw: has('metadata') ? `"metadata"` : 'NULL',
    requestContext: colOrNull('requestContext'),
  };

  return VNEXT_SPAN_COLUMNS.map(c => `${exprs[c]} AS "${c}"`).join(',\n    ');
}

export interface LegacySpanMigrationResult {
  migratedRows: number;
  batches: number;
}

/**
 * Migrate span data from legacy mastra_ai_spans to VNext mastra_span_events.
 * Runs entirely server-side inside ClickHouse using batched INSERT...SELECT by day.
 * Does NOT drop the legacy table — the user should drop it manually after verification.
 */
export async function migrateLegacySpans(
  client: ClickHouseClient,
  logger?: IMastraLogger,
): Promise<LegacySpanMigrationResult> {
  if (await hasMarkerRow(client)) {
    return { migratedRows: 0, batches: 0 };
  }

  const engine = await getTableEngine(client, TABLE_LEGACY_SPANS);
  if (!engine) {
    return { migratedRows: 0, batches: 0 };
  }

  const legacyColumnTypes = await getTableColumnTypes(client, TABLE_LEGACY_SPANS);
  const hasUpdatedAt = legacyColumnTypes.has('updatedAt');

  // Create base tables and MVs so inserted rows flow into trace_roots/trace_branches.
  await client.command({ query: SPAN_EVENTS_DDL });
  await client.command({ query: TRACE_ROOTS_DDL });
  await client.command({ query: TRACE_BRANCHES_DDL });
  await client.command({ query: TRACE_ROOTS_MV_DDL });
  await client.command({ query: TRACE_BRANCHES_MV_DDL });

  const selectExprs = buildLegacySpanSelectExprs(legacyColumnTypes);
  const columnList = VNEXT_SPAN_COLUMNS.map(c => `"${c}"`).join(', ');

  // Dedup ORDER BY: pick the most recent version of each (traceId, spanId)
  const dedupOrder = hasUpdatedAt
    ? `ORDER BY "traceId", "spanId", COALESCE("updatedAt", "createdAt") DESC`
    : `ORDER BY "traceId", "spanId", "createdAt" DESC`;

  // Query all populated days at once to avoid scanning empty days.
  const daysResult = await client.query({
    query: `SELECT
      toString(toDate(COALESCE(endedAt, startedAt))) as day,
      count() as cnt
    FROM ${TABLE_LEGACY_SPANS}
    GROUP BY day
    ORDER BY day`,
    format: 'JSONEachRow',
  });
  const days = (await daysResult.json()) as Array<{ day: string; cnt: string | number }>;

  let migratedRows = 0;
  let batches = 0;

  for (const { day, cnt } of days) {
    const dayCount = Number(cnt);

    await client.command({
      query: `INSERT INTO ${TABLE_SPAN_EVENTS} (${columnList})
        SELECT ${selectExprs}
        FROM ${TABLE_LEGACY_SPANS}
        WHERE toDate(COALESCE(endedAt, startedAt)) = {batchDate:Date}
        ${dedupOrder}
        LIMIT 1 BY "traceId", "spanId"`,
      query_params: { batchDate: day },
    });

    migratedRows += dayCount;
    batches++;
    logger?.info?.(`Migrated batch ${day}: ${dayCount} rows`);
  }

  // Write marker so subsequent runs skip.
  await client.command({
    query: `CREATE TABLE IF NOT EXISTS ${TABLE_LEGACY_MIGRATION_DONE} (completedAt DateTime64(3, 'UTC')) ENGINE = MergeTree ORDER BY completedAt`,
  });
  await client.command({
    query: `INSERT INTO ${TABLE_LEGACY_MIGRATION_DONE} VALUES (now64(3))`,
  });

  logger?.info?.(
    `Legacy span migration complete: ${migratedRows} rows in ${batches} batches. ` +
      `The legacy table '${TABLE_LEGACY_SPANS}' has been preserved. Drop it manually after verifying the migration.`,
  );

  return { migratedRows, batches };
}

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
