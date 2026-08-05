import { createClient } from '@clickhouse/client';
import type { ClickHouseClient } from '@clickhouse/client';
import { MastraError } from '@mastra/core/error';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALL_TABLE_NAMES,
  MV_DISCOVERY_PAIRS,
  MV_DISCOVERY_VALUES,
  MV_FEEDBACK_EVENTS_DELTA,
  MV_LOG_EVENTS_DELTA,
  MV_METRIC_EVENTS_DELTA,
  MV_SCORE_EVENTS_DELTA,
  MV_TRACE_BRANCHES,
  MV_TRACE_BRANCHES_DELTA,
  MV_TRACE_ROOTS,
  MV_TRACE_ROOTS_DELTA,
  TABLE_LOG_EVENTS,
  TABLE_METRIC_EVENTS,
  TABLE_SPAN_EVENTS,
  TABLE_TRACE_ROOTS,
} from './ddl';
import {
  checkLegacySpanMigrationStatus,
  isReplacingMergeTreeEngine,
  migrateLegacySpans,
  migrateSignalTables,
} from './migration';
import { ObservabilityStorageClickhouseVNext } from '.';

describe('isReplacingMergeTreeEngine', () => {
  it('accepts plain ReplacingMergeTree', () => {
    expect(isReplacingMergeTreeEngine('ReplacingMergeTree')).toBe(true);
  });

  it('accepts SharedReplacingMergeTree (ClickHouse Cloud rewrite)', () => {
    expect(isReplacingMergeTreeEngine('SharedReplacingMergeTree')).toBe(true);
  });

  it('accepts ReplicatedReplacingMergeTree (self-managed replicated clusters)', () => {
    expect(isReplacingMergeTreeEngine('ReplicatedReplacingMergeTree')).toBe(true);
  });

  it('rejects non-replacing engines', () => {
    expect(isReplacingMergeTreeEngine('MergeTree')).toBe(false);
    expect(isReplacingMergeTreeEngine('SharedMergeTree')).toBe(false);
    expect(isReplacingMergeTreeEngine('AggregatingMergeTree')).toBe(false);
    expect(isReplacingMergeTreeEngine('Log')).toBe(false);
    expect(isReplacingMergeTreeEngine('')).toBe(false);
  });
});

/** Wraps a client so that INSERT commands throw — used to exercise rollback. */
function clientThatFailsOnInsert(real: ClickHouseClient): ClickHouseClient {
  return new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === 'command') {
        return async (args: { query: string }) => {
          if (/^\s*INSERT\s+INTO/i.test(args.query)) {
            throw new Error('Simulated INSERT failure');
          }
          return target.command(args);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as ClickHouseClient;
}

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALL_VIEW_NAMES = [
  MV_TRACE_ROOTS,
  MV_TRACE_BRANCHES,
  MV_TRACE_ROOTS_DELTA,
  MV_TRACE_BRANCHES_DELTA,
  MV_METRIC_EVENTS_DELTA,
  MV_LOG_EVENTS_DELTA,
  MV_SCORE_EVENTS_DELTA,
  MV_FEEDBACK_EVENTS_DELTA,
  MV_DISCOVERY_VALUES,
  MV_DISCOVERY_PAIRS,
];

/** Minimal legacy log_events schema: MergeTree + all non-nullable columns of the new DDL minus logId. */
const LEGACY_LOG_DDL = `
CREATE TABLE ${TABLE_LOG_EVENTS} (
  timestamp DateTime64(3, 'UTC'),
  traceId Nullable(String),
  spanId Nullable(String),
  level LowCardinality(String),
  message String,
  tags Array(LowCardinality(String)) DEFAULT []
)
ENGINE = MergeTree
ORDER BY timestamp
`;

const LEGACY_METRIC_DDL = `
CREATE TABLE ${TABLE_METRIC_EVENTS} (
  timestamp DateTime64(3, 'UTC'),
  name LowCardinality(String),
  value Float64,
  tags Array(LowCardinality(String)) DEFAULT [],
  labels Map(LowCardinality(String), String) DEFAULT map()
)
ENGINE = MergeTree
ORDER BY (name, timestamp)
`;

async function dropAll(client: ClickHouseClient): Promise<void> {
  for (const view of ALL_VIEW_NAMES) {
    await client.command({ query: `DROP VIEW IF EXISTS ${view}` });
  }
  for (const table of ALL_TABLE_NAMES) {
    await client.command({ query: `DROP TABLE IF EXISTS ${table}` });
  }
  // Drop legacy span migration tables
  await client.command({ query: `DROP TABLE IF EXISTS mastra_ai_spans` });
  await client.command({ query: `DROP TABLE IF EXISTS mastra_legacy_span_migration_done` });
  const leftovers = await client.query({
    query: `SELECT name FROM system.tables WHERE database = currentDatabase() AND name LIKE '%_migrating_%'`,
    format: 'JSONEachRow',
  });
  for (const row of (await leftovers.json()) as Array<{ name: string }>) {
    await client.command({ query: `DROP TABLE IF EXISTS ${row.name}` });
  }
}

async function getEngine(client: ClickHouseClient, table: string): Promise<string | null> {
  const result = await client.query({
    query: `SELECT engine FROM system.tables WHERE database = currentDatabase() AND name = {table:String}`,
    query_params: { table },
    format: 'JSONEachRow',
  });
  const rows = (await result.json()) as Array<{ engine: string }>;
  return rows[0]?.engine ?? null;
}

describe('migrateSignalTables (ClickHouse v-next)', () => {
  let client: ClickHouseClient;

  beforeAll(() => {
    client = createClient({
      url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
      username: process.env.CLICKHOUSE_USERNAME || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || 'password',
    });
  });

  beforeEach(async () => {
    await dropAll(client);
  });

  afterAll(async () => {
    await dropAll(client);
    await client.close();
  });

  it('is a no-op when signal tables do not exist', async () => {
    await expect(migrateSignalTables(client)).resolves.not.toThrow();
    expect(await getEngine(client, TABLE_LOG_EVENTS)).toBeNull();
  });

  it('migrates a legacy MergeTree log_events table, preserving rows and generating logIds', async () => {
    await client.command({ query: LEGACY_LOG_DDL });
    await client.insert({
      table: TABLE_LOG_EVENTS,
      values: [
        { timestamp: '2026-01-01 00:00:00.000', traceId: 'trace-a', spanId: 'span-a', level: 'info', message: 'hello' },
        {
          timestamp: '2026-01-01 00:00:01.000',
          traceId: 'trace-a',
          spanId: 'span-b',
          level: 'error',
          message: 'world',
        },
      ],
      format: 'JSONEachRow',
    });

    await migrateSignalTables(client);

    expect(await getEngine(client, TABLE_LOG_EVENTS)).toBe('ReplacingMergeTree');

    const result = await client.query({
      query: `SELECT logId, message FROM ${TABLE_LOG_EVENTS} ORDER BY timestamp`,
      format: 'JSONEachRow',
    });
    const rows = (await result.json()) as Array<{ logId: string; message: string }>;
    expect(rows).toHaveLength(2);
    expect(rows[0]!.message).toBe('hello');
    expect(rows[1]!.message).toBe('world');
    expect(rows[0]!.logId).toMatch(UUID_RE);
    expect(rows[1]!.logId).toMatch(UUID_RE);
    expect(rows[0]!.logId).not.toBe(rows[1]!.logId);

    const leftovers = await client.query({
      query: `SELECT name FROM system.tables WHERE database = currentDatabase() AND name LIKE '${TABLE_LOG_EVENTS}_migrating_%'`,
      format: 'JSONEachRow',
    });
    expect((await leftovers.json()) as unknown[]).toHaveLength(0);
  });

  it('preserves existing non-empty IDs and backfills empty ones', async () => {
    // Legacy table that already had a logId column (but no PK/ORDER BY on it).
    await client.command({
      query: `
        CREATE TABLE ${TABLE_LOG_EVENTS} (
          timestamp DateTime64(3, 'UTC'),
          logId String,
          level LowCardinality(String),
          message String,
          tags Array(LowCardinality(String)) DEFAULT []
        )
        ENGINE = MergeTree
        ORDER BY timestamp
      `,
    });

    await client.insert({
      table: TABLE_LOG_EVENTS,
      values: [
        { timestamp: '2026-01-01 00:00:00.000', logId: 'existing-id', level: 'info', message: 'keep' },
        { timestamp: '2026-01-01 00:00:01.000', logId: '', level: 'info', message: 'backfill' },
      ],
      format: 'JSONEachRow',
    });

    await migrateSignalTables(client);

    const result = await client.query({
      query: `SELECT logId, message FROM ${TABLE_LOG_EVENTS} ORDER BY timestamp`,
      format: 'JSONEachRow',
    });
    const rows = (await result.json()) as Array<{ logId: string; message: string }>;
    expect(rows[0]!.logId).toBe('existing-id');
    expect(rows[1]!.logId).toMatch(UUID_RE);
  });

  it('is idempotent: second run leaves rows and engine untouched', async () => {
    await client.command({ query: LEGACY_METRIC_DDL });
    await client.insert({
      table: TABLE_METRIC_EVENTS,
      values: [{ timestamp: '2026-01-01 00:00:00.000', name: 'latency', value: 42 }],
      format: 'JSONEachRow',
    });

    await migrateSignalTables(client);
    const first = (await (
      await client.query({ query: `SELECT metricId FROM ${TABLE_METRIC_EVENTS}`, format: 'JSONEachRow' })
    ).json()) as Array<{ metricId: string }>;
    expect(first).toHaveLength(1);
    expect(first[0]!.metricId).toMatch(UUID_RE);

    await migrateSignalTables(client);
    const second = (await (
      await client.query({ query: `SELECT metricId FROM ${TABLE_METRIC_EVENTS}`, format: 'JSONEachRow' })
    ).json()) as Array<{ metricId: string }>;
    expect(second).toHaveLength(1);
    expect(second[0]!.metricId).toBe(first[0]!.metricId);
  });

  it('requires manual migration before init and migrates legacy signal tables through migrateSpans()', async () => {
    await client.command({ query: LEGACY_LOG_DDL });
    await client.insert({
      table: TABLE_LOG_EVENTS,
      values: [
        { timestamp: '2026-01-01 00:00:00.000', traceId: 'trace-a', spanId: 'span-a', level: 'info', message: 'hello' },
      ],
      format: 'JSONEachRow',
    });

    const legacyStore = new ObservabilityStorageClickhouseVNext({ client });

    await expect(legacyStore.init()).rejects.toThrow(/MIGRATION REQUIRED/);

    await expect(legacyStore.migrateSpans()).resolves.toMatchObject({
      success: true,
      alreadyMigrated: false,
    });

    await expect(legacyStore.init()).resolves.not.toThrow();

    const result = await client.query({
      query: `SELECT logId, message FROM ${TABLE_LOG_EVENTS} ORDER BY timestamp`,
      format: 'JSONEachRow',
    });
    const rows = (await result.json()) as Array<{ logId: string; message: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.message).toBe('hello');
    expect(rows[0]!.logId).toMatch(UUID_RE);
    expect(await getEngine(client, TABLE_LOG_EVENTS)).toBe('ReplacingMergeTree');
  });

  it('enables ReplacingMergeTree dedup on the migrated signal ID', async () => {
    await client.command({ query: LEGACY_LOG_DDL });
    await client.insert({
      table: TABLE_LOG_EVENTS,
      values: [{ timestamp: '2026-01-01 00:00:00.000', level: 'info', message: 'original' }],
      format: 'JSONEachRow',
    });

    await migrateSignalTables(client);

    const existing = (await (
      await client.query({ query: `SELECT logId FROM ${TABLE_LOG_EVENTS}`, format: 'JSONEachRow' })
    ).json()) as Array<{ logId: string }>;
    const logId = existing[0]!.logId;

    // Same timestamp + same logId: ORDER BY (timestamp, logId) matches → ReplacingMergeTree collapses.
    await client.insert({
      table: TABLE_LOG_EVENTS,
      values: [{ timestamp: '2026-01-01 00:00:00.000', logId, level: 'info', message: 'updated' }],
      format: 'JSONEachRow',
    });
    await client.command({ query: `OPTIMIZE TABLE ${TABLE_LOG_EVENTS} FINAL` });

    const deduped = (await (
      await client.query({
        query: `SELECT message FROM ${TABLE_LOG_EVENTS} WHERE logId = {logId:String}`,
        query_params: { logId },
        format: 'JSONEachRow',
      })
    ).json()) as Array<{ message: string }>;
    expect(deduped).toHaveLength(1);
    expect(deduped[0]!.message).toBe('updated');
  });

  it('leaves the original table untouched when INSERT into the temp table fails', async () => {
    await client.command({ query: LEGACY_LOG_DDL });
    await client.insert({
      table: TABLE_LOG_EVENTS,
      values: [{ timestamp: '2026-01-01 00:00:00.000', level: 'info', message: 'keep-me' }],
      format: 'JSONEachRow',
    });

    await expect(migrateSignalTables(clientThatFailsOnInsert(client))).rejects.toBeInstanceOf(MastraError);

    // Original table must be restored with its data intact and still in legacy (MergeTree) shape.
    expect(await getEngine(client, TABLE_LOG_EVENTS)).toBe('MergeTree');

    const rows = (await (
      await client.query({
        query: `SELECT message FROM ${TABLE_LOG_EVENTS}`,
        format: 'JSONEachRow',
      })
    ).json()) as Array<{ message: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.message).toBe('keep-me');

    // No orphaned temp tables.
    const leftovers = (await (
      await client.query({
        query: `SELECT name FROM system.tables WHERE database = currentDatabase() AND name LIKE '${TABLE_LOG_EVENTS}_migrating_%'`,
        format: 'JSONEachRow',
      })
    ).json()) as unknown[];
    expect(leftovers).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Legacy span migration: mastra_ai_spans → mastra_span_events
// ---------------------------------------------------------------------------

/** Minimal legacy schema — only the columns from OLD_SPAN_SCHEMA (pre-entity-hierarchy). */
const LEGACY_SPANS_MINIMAL_DDL = `
CREATE TABLE mastra_ai_spans (
  "traceId" String,
  "spanId" String,
  "parentSpanId" Nullable(String),
  "name" String,
  "spanType" String,
  "isEvent" Bool DEFAULT false,
  "startedAt" DateTime64(3, 'UTC'),
  "endedAt" Nullable(DateTime64(3, 'UTC')),
  "createdAt" DateTime64(3, 'UTC'),
  "updatedAt" DateTime64(3, 'UTC'),
  "scope" Nullable(String),
  "attributes" Nullable(String),
  "metadata" Nullable(String),
  "links" Nullable(String),
  "input" Nullable(String),
  "output" Nullable(String),
  "error" Nullable(String)
)
ENGINE = ReplacingMergeTree(updatedAt)
ORDER BY ("traceId", "spanId")
SETTINGS index_granularity = 8192
`;

/** Full legacy schema — includes all columns added over time via alterTable. */
const LEGACY_SPANS_FULL_DDL = `
CREATE TABLE mastra_ai_spans (
  "traceId" String,
  "spanId" String,
  "parentSpanId" Nullable(String),
  "name" String,
  "spanType" String,
  "isEvent" Bool DEFAULT false,
  "startedAt" DateTime64(3, 'UTC'),
  "endedAt" Nullable(DateTime64(3, 'UTC')),
  "createdAt" DateTime64(3, 'UTC'),
  "updatedAt" DateTime64(3, 'UTC'),
  "scope" Nullable(String),
  "attributes" Nullable(String),
  "metadata" Nullable(String),
  "links" Nullable(String),
  "input" Nullable(String),
  "output" Nullable(String),
  "error" Nullable(String),
  "requestContext" Nullable(String),
  "source" Nullable(String),
  "tags" Array(String) DEFAULT [],
  "entityType" Nullable(String),
  "entityId" Nullable(String),
  "entityName" Nullable(String),
  "entityVersionId" Nullable(String),
  "parentEntityType" Nullable(String),
  "parentEntityId" Nullable(String),
  "parentEntityName" Nullable(String),
  "parentEntityVersionId" Nullable(String),
  "rootEntityType" Nullable(String),
  "rootEntityId" Nullable(String),
  "rootEntityName" Nullable(String),
  "rootEntityVersionId" Nullable(String),
  "userId" Nullable(String),
  "organizationId" Nullable(String),
  "resourceId" Nullable(String),
  "runId" Nullable(String),
  "sessionId" Nullable(String),
  "threadId" Nullable(String),
  "requestId" Nullable(String),
  "environment" Nullable(String),
  "serviceName" Nullable(String),
  "experimentId" Nullable(String)
)
ENGINE = ReplacingMergeTree(updatedAt)
ORDER BY ("traceId", "spanId")
SETTINGS index_granularity = 8192
`;

describe('migrateLegacySpans (mastra_ai_spans → mastra_span_events)', () => {
  let client: ClickHouseClient;

  beforeAll(() => {
    client = createClient({
      url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
      username: process.env.CLICKHOUSE_USERNAME || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || 'password',
    });
  });

  beforeEach(async () => {
    await dropAll(client);
  });

  afterAll(async () => {
    await dropAll(client);
    await client.close();
  });

  it('is a no-op when legacy table does not exist', async () => {
    const result = await migrateLegacySpans(client);
    expect(result).toEqual({ migratedRows: 0, batches: 0 });
  });

  it('returns needsMigration=false when legacy table does not exist', async () => {
    const status = await checkLegacySpanMigrationStatus(client);
    expect(status.needsMigration).toBe(false);
  });

  it('returns needsMigration=false when legacy table is empty', async () => {
    await client.command({ query: LEGACY_SPANS_MINIMAL_DDL });
    const status = await checkLegacySpanMigrationStatus(client);
    expect(status.needsMigration).toBe(false);
  });

  it('is a no-op when legacy table exists but is empty', async () => {
    await client.command({ query: LEGACY_SPANS_MINIMAL_DDL });
    const result = await migrateLegacySpans(client);
    expect(result).toEqual({ migratedRows: 0, batches: 0 });
  });

  it('migrates minimal legacy schema with missing newer columns', async () => {
    await client.command({ query: LEGACY_SPANS_MINIMAL_DDL });
    await client.insert({
      table: 'mastra_ai_spans',
      values: [
        {
          traceId: 'trace-1',
          spanId: 'span-1',
          parentSpanId: null,
          name: 'agent-run',
          spanType: 'agent_run',
          isEvent: false,
          startedAt: '2026-01-15 10:00:00.000',
          endedAt: '2026-01-15 10:00:01.000',
          createdAt: '2026-01-15 10:00:00.000',
          updatedAt: '2026-01-15 10:00:01.000',
          metadata: '{"customKey":"val"}',
        },
        {
          traceId: 'trace-2',
          spanId: 'span-2',
          parentSpanId: 'span-1',
          name: 'tool-call',
          spanType: 'tool_call',
          isEvent: false,
          startedAt: '2026-01-16 12:00:00.000',
          endedAt: null, // NULL endedAt — should be coalesced
          createdAt: '2026-01-16 12:00:00.000',
          updatedAt: '2026-01-16 12:00:00.000',
        },
      ],
      format: 'JSONEachRow',
      clickhouse_settings: { date_time_input_format: 'best_effort' },
    });

    const result = await migrateLegacySpans(client);
    expect(result.migratedRows).toBe(2);
    expect(result.batches).toBe(2); // Two different days

    const rows = (await (
      await client.query({
        query: `SELECT * FROM ${TABLE_SPAN_EVENTS} ORDER BY startedAt`,
        format: 'JSONEachRow',
        clickhouse_settings: { date_time_output_format: 'iso' },
      })
    ).json()) as Array<Record<string, unknown>>;

    expect(rows).toHaveLength(2);

    // dedupeKey is traceId:spanId
    expect(rows[0]!.dedupeKey).toBe('trace-1:span-1');
    expect(rows[1]!.dedupeKey).toBe('trace-2:span-2');

    // Missing columns are NULL
    expect(rows[0]!.entityType).toBeNull();
    expect(rows[0]!.executionSource).toBeNull();

    // NULL endedAt coalesced from startedAt
    expect(rows[1]!.endedAt).toBe(rows[1]!.startedAt);
  });

  it('migrates full legacy schema with column renames and metadata transform', async () => {
    await client.command({ query: LEGACY_SPANS_FULL_DDL });
    await client.insert({
      table: 'mastra_ai_spans',
      values: [
        {
          traceId: 'trace-1',
          spanId: 'span-1',
          parentSpanId: null,
          name: 'agent-run',
          spanType: 'agent_run',
          isEvent: false,
          startedAt: '2026-03-01 08:00:00.000',
          endedAt: '2026-03-01 08:00:05.000',
          createdAt: '2026-03-01 08:00:00.000',
          updatedAt: '2026-03-01 08:00:05.000',
          source: 'cloud',
          tags: ['prod', 'v2'],
          entityType: 'agent',
          entityId: 'my-agent',
          entityName: 'My Agent',
          metadata: '{"customKey":"val","entityType":"agent","nested":{"deep":true}}',
          environment: 'production',
          serviceName: 'my-service',
        },
      ],
      format: 'JSONEachRow',
      clickhouse_settings: { date_time_input_format: 'best_effort' },
    });

    await migrateLegacySpans(client);

    const rows = (await (
      await client.query({
        query: `SELECT * FROM ${TABLE_SPAN_EVENTS}`,
        format: 'JSONEachRow',
        clickhouse_settings: { date_time_output_format: 'iso' },
      })
    ).json()) as Array<Record<string, unknown>>;

    expect(rows).toHaveLength(1);
    const row = rows[0]!;

    // source → executionSource rename
    expect(row.executionSource).toBe('cloud');

    // tags preserved
    expect(row.tags).toEqual(['prod', 'v2']);

    // entity fields preserved
    expect(row.entityType).toBe('agent');
    expect(row.entityId).toBe('my-agent');
    expect(row.entityName).toBe('My Agent');

    // metadata → metadataRaw rename
    expect(JSON.parse(row.metadataRaw as string)).toEqual({
      customKey: 'val',
      entityType: 'agent',
      nested: { deep: true },
    });

    // metadataSearch: only flat string values excluding promoted keys
    // "entityType" is a promoted key → excluded
    // "nested" is an object → excluded by JSONExtractKeysAndValues with 'String' type
    // Only "customKey":"val" should remain
    const metadataSearch = row.metadataSearch as Record<string, string>;
    expect(metadataSearch).toHaveProperty('customKey', 'val');
    expect(metadataSearch).not.toHaveProperty('entityType');

    expect(row.environment).toBe('production');
    expect(row.serviceName).toBe('my-service');
  });

  it('deduplicates legacy rows, keeping the latest updatedAt', async () => {
    await client.command({ query: LEGACY_SPANS_MINIMAL_DDL });

    // Insert two rows with the same (traceId, spanId) but different updatedAt
    await client.insert({
      table: 'mastra_ai_spans',
      values: [
        {
          traceId: 'trace-dup',
          spanId: 'span-dup',
          name: 'old-version',
          spanType: 'agent_run',
          isEvent: false,
          startedAt: '2026-02-01 10:00:00.000',
          endedAt: '2026-02-01 10:00:01.000',
          createdAt: '2026-02-01 10:00:00.000',
          updatedAt: '2026-02-01 10:00:01.000',
        },
        {
          traceId: 'trace-dup',
          spanId: 'span-dup',
          name: 'new-version',
          spanType: 'agent_run',
          isEvent: false,
          startedAt: '2026-02-01 10:00:00.000',
          endedAt: '2026-02-01 10:00:02.000',
          createdAt: '2026-02-01 10:00:00.000',
          updatedAt: '2026-02-01 10:00:05.000',
        },
      ],
      format: 'JSONEachRow',
      clickhouse_settings: { date_time_input_format: 'best_effort' },
    });

    await migrateLegacySpans(client);
    await client.command({ query: `OPTIMIZE TABLE ${TABLE_SPAN_EVENTS} FINAL` });

    const rows = (await (
      await client.query({
        query: `SELECT name FROM ${TABLE_SPAN_EVENTS}`,
        format: 'JSONEachRow',
      })
    ).json()) as Array<{ name: string }>;

    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe('new-version');
  });

  it('is idempotent: second run does not create extra rows', async () => {
    await client.command({ query: LEGACY_SPANS_MINIMAL_DDL });
    await client.insert({
      table: 'mastra_ai_spans',
      values: [
        {
          traceId: 'trace-idem',
          spanId: 'span-idem',
          name: 'test',
          spanType: 'agent_run',
          isEvent: false,
          startedAt: '2026-04-01 10:00:00.000',
          endedAt: '2026-04-01 10:00:01.000',
          createdAt: '2026-04-01 10:00:00.000',
          updatedAt: '2026-04-01 10:00:01.000',
        },
      ],
      format: 'JSONEachRow',
      clickhouse_settings: { date_time_input_format: 'best_effort' },
    });

    await migrateLegacySpans(client);
    await migrateLegacySpans(client);
    await client.command({ query: `OPTIMIZE TABLE ${TABLE_SPAN_EVENTS} FINAL` });

    const rows = (await (
      await client.query({
        query: `SELECT * FROM ${TABLE_SPAN_EVENTS}`,
        format: 'JSONEachRow',
      })
    ).json()) as unknown[];

    expect(rows).toHaveLength(1);
  });

  it('migrates through migrateSpans() and reports legacy span count', async () => {
    await client.command({ query: LEGACY_SPANS_MINIMAL_DDL });
    await client.insert({
      table: 'mastra_ai_spans',
      values: [
        {
          traceId: 'trace-int',
          spanId: 'span-int',
          name: 'integration-test',
          spanType: 'agent_run',
          isEvent: false,
          startedAt: '2026-07-01 10:00:00.000',
          endedAt: '2026-07-01 10:00:01.000',
          createdAt: '2026-07-01 10:00:00.000',
          updatedAt: '2026-07-01 10:00:01.000',
        },
      ],
      format: 'JSONEachRow',
      clickhouse_settings: { date_time_input_format: 'best_effort' },
    });

    const store = new ObservabilityStorageClickhouseVNext({ client });
    const result = await store.migrateSpans();

    expect(result.success).toBe(true);
    expect(result.alreadyMigrated).toBe(false);
    expect(result.message).toMatch(/Migrated 1 legacy spans in 1 batches/);
  });

  it('reports alreadyMigrated when no migrations are needed', async () => {
    // No legacy table, no signal tables needing migration
    const store = new ObservabilityStorageClickhouseVNext({ client });
    const result = await store.migrateSpans();

    expect(result.success).toBe(true);
    expect(result.alreadyMigrated).toBe(true);
  });

  it('populates materialized views even without prior init()', async () => {
    // Migration creates MVs itself — no need for store.init() first.
    await client.command({ query: LEGACY_SPANS_FULL_DDL });
    await client.insert({
      table: 'mastra_ai_spans',
      values: [
        {
          traceId: 'trace-mv',
          spanId: 'span-root',
          parentSpanId: null,
          name: 'root-agent',
          spanType: 'agent_run',
          isEvent: false,
          startedAt: '2026-08-01 10:00:00.000',
          endedAt: '2026-08-01 10:00:05.000',
          createdAt: '2026-08-01 10:00:00.000',
          updatedAt: '2026-08-01 10:00:05.000',
          entityType: 'agent',
        },
        {
          traceId: 'trace-mv',
          spanId: 'span-child',
          parentSpanId: 'span-root',
          name: 'child-tool',
          spanType: 'tool_call',
          isEvent: false,
          startedAt: '2026-08-01 10:00:01.000',
          endedAt: '2026-08-01 10:00:02.000',
          createdAt: '2026-08-01 10:00:01.000',
          updatedAt: '2026-08-01 10:00:02.000',
          entityType: 'tool',
        },
      ],
      format: 'JSONEachRow',
      clickhouse_settings: { date_time_input_format: 'best_effort' },
    });

    await migrateLegacySpans(client);

    const rootRows = (await (
      await client.query({
        query: `SELECT "traceId", "spanId", "name" FROM ${TABLE_TRACE_ROOTS}`,
        format: 'JSONEachRow',
      })
    ).json()) as Array<{ traceId: string; spanId: string; name: string }>;

    expect(rootRows).toHaveLength(1);
    expect(rootRows[0]!.spanId).toBe('span-root');
    expect(rootRows[0]!.name).toBe('root-agent');
  });

  it('converts parentSpanId empty string to NULL so root spans appear in trace_roots', async () => {
    await client.command({ query: LEGACY_SPANS_MINIMAL_DDL });
    await client.insert({
      table: 'mastra_ai_spans',
      values: [
        {
          traceId: 'trace-empty-parent',
          spanId: 'span-root-empty',
          parentSpanId: '', // Legacy stores empty string for root spans
          name: 'root-with-empty-parent',
          spanType: 'agent_run',
          isEvent: false,
          startedAt: '2026-09-01 10:00:00.000',
          endedAt: '2026-09-01 10:00:01.000',
          createdAt: '2026-09-01 10:00:00.000',
          updatedAt: '2026-09-01 10:00:01.000',
        },
      ],
      format: 'JSONEachRow',
      clickhouse_settings: { date_time_input_format: 'best_effort' },
    });

    await migrateLegacySpans(client);

    // parentSpanId should be NULL in VNext, not ''
    const rows = (await (
      await client.query({
        query: `SELECT "parentSpanId" FROM ${TABLE_SPAN_EVENTS}`,
        format: 'JSONEachRow',
      })
    ).json()) as Array<{ parentSpanId: string | null }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.parentSpanId).toBeNull();

    // And it should appear in trace_roots MV
    const rootRows = (await (
      await client.query({
        query: `SELECT "spanId" FROM ${TABLE_TRACE_ROOTS}`,
        format: 'JSONEachRow',
      })
    ).json()) as Array<{ spanId: string }>;
    expect(rootRows).toHaveLength(1);
    expect(rootRows[0]!.spanId).toBe('span-root-empty');
  });

  it('handles legacy tags stored as Nullable(String) JSON text', async () => {
    // Very old schemas store tags as Nullable(String) containing JSON arrays
    await client.command({
      query: `
      CREATE TABLE mastra_ai_spans (
        "traceId" String,
        "spanId" String,
        "parentSpanId" Nullable(String),
        "name" String,
        "spanType" String,
        "isEvent" Bool DEFAULT false,
        "startedAt" DateTime64(3, 'UTC'),
        "endedAt" Nullable(DateTime64(3, 'UTC')),
        "createdAt" DateTime64(3, 'UTC'),
        "updatedAt" DateTime64(3, 'UTC'),
        "tags" Nullable(String)
      )
      ENGINE = ReplacingMergeTree(updatedAt)
      ORDER BY ("traceId", "spanId")
      `,
    });

    await client.insert({
      table: 'mastra_ai_spans',
      values: [
        {
          traceId: 'trace-json-tags',
          spanId: 'span-json-tags',
          name: 'test',
          spanType: 'agent_run',
          isEvent: false,
          startedAt: '2026-10-01 10:00:00.000',
          endedAt: '2026-10-01 10:00:01.000',
          createdAt: '2026-10-01 10:00:00.000',
          updatedAt: '2026-10-01 10:00:01.000',
          tags: '["prod", "v2", "prod"]', // JSON text with duplicate
        },
      ],
      format: 'JSONEachRow',
      clickhouse_settings: { date_time_input_format: 'best_effort' },
    });

    await migrateLegacySpans(client);

    const rows = (await (
      await client.query({
        query: `SELECT "tags" FROM ${TABLE_SPAN_EVENTS}`,
        format: 'JSONEachRow',
      })
    ).json()) as Array<{ tags: string[] }>;
    expect(rows).toHaveLength(1);
    // Should be parsed from JSON, deduplicated
    expect(rows[0]!.tags).toContain('prod');
    expect(rows[0]!.tags).toContain('v2');
    expect(rows[0]!.tags.filter(t => t === 'prod')).toHaveLength(1); // deduplicated
  });

  it('is truly idempotent via marker table — second run skips migration', async () => {
    await client.command({ query: LEGACY_SPANS_MINIMAL_DDL });
    await client.insert({
      table: 'mastra_ai_spans',
      values: [
        {
          traceId: 'trace-marker',
          spanId: 'span-marker',
          name: 'test',
          spanType: 'agent_run',
          isEvent: false,
          startedAt: '2026-11-01 10:00:00.000',
          endedAt: '2026-11-01 10:00:01.000',
          createdAt: '2026-11-01 10:00:00.000',
          updatedAt: '2026-11-01 10:00:01.000',
        },
      ],
      format: 'JSONEachRow',
      clickhouse_settings: { date_time_input_format: 'best_effort' },
    });

    const first = await migrateLegacySpans(client);
    expect(first.migratedRows).toBe(1);

    // Second run should detect marker and skip entirely
    const second = await migrateLegacySpans(client);
    expect(second.migratedRows).toBe(0);
    expect(second.batches).toBe(0);

    // Status check should also report no migration needed
    const status = await checkLegacySpanMigrationStatus(client);
    expect(status.needsMigration).toBe(false);
  });

  it('does not skip migration when marker table exists but has no rows (crash recovery)', async () => {
    // Simulate a crash: marker table was created but INSERT never happened
    await client.command({
      query: `CREATE TABLE mastra_legacy_span_migration_done (completedAt DateTime64(3, 'UTC')) ENGINE = MergeTree ORDER BY completedAt`,
    });

    await client.command({ query: LEGACY_SPANS_MINIMAL_DDL });
    await client.insert({
      table: 'mastra_ai_spans',
      values: [
        {
          traceId: 'trace-crash',
          spanId: 'span-crash',
          name: 'test',
          spanType: 'agent_run',
          isEvent: false,
          startedAt: '2026-12-01 10:00:00.000',
          endedAt: '2026-12-01 10:00:01.000',
          createdAt: '2026-12-01 10:00:00.000',
          updatedAt: '2026-12-01 10:00:01.000',
        },
      ],
      format: 'JSONEachRow',
      clickhouse_settings: { date_time_input_format: 'best_effort' },
    });

    // Empty marker table should NOT suppress migration
    const status = await checkLegacySpanMigrationStatus(client);
    expect(status.needsMigration).toBe(true);

    const result = await migrateLegacySpans(client);
    expect(result.migratedRows).toBe(1);
  });
});
