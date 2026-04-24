import { createClient } from '@clickhouse/client';
import type { ClickHouseClient } from '@clickhouse/client';
import { MastraError } from '@mastra/core/error';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TABLE_LOG_EVENTS, TABLE_METRIC_EVENTS, TABLE_SCORE_EVENTS, TABLE_FEEDBACK_EVENTS } from './ddl';
import { isReplacingMergeTreeEngine, migrateSignalTables } from './migration';
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
const ALL_SIGNAL_TABLES = [TABLE_METRIC_EVENTS, TABLE_LOG_EVENTS, TABLE_SCORE_EVENTS, TABLE_FEEDBACK_EVENTS];

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
  for (const table of ALL_SIGNAL_TABLES) {
    await client.command({ query: `DROP TABLE IF EXISTS ${table}` });
  }
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
