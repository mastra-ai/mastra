/**
 * Retention tests for the v-next Postgres observability domain (native
 * partition mode, which is what plain Postgres resolves to).
 *
 * Old-day partitions are created manually (init() only pre-creates
 * [yesterday, today + N]), rows are inserted through the domain API so they
 * route into those partitions, and prune() is asserted to drop exactly the
 * partitions that are wholly older than the cutoff.
 */

import { SpanType } from '@mastra/core/observability';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { DbClient } from '../../../client';
import { PoolAdapter } from '../../../client';
import { connectionString } from '../../../test-utils';
import { qualifiedTable, TABLE_LOG_EVENTS, TABLE_METRIC_EVENTS, TABLE_SCORE_EVENTS, TABLE_SPAN_EVENTS } from './ddl';
import { listPartitions } from './partitioning';
import { ObservabilityStoragePostgresVNext } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

function quoted(value: string): string {
  return `"${value}"`;
}

function dayAt(dayOffset: number, hour = 12): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, hour));
}

function dayBounds(d: Date): { start: string; end: string; suffix: string } {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const next = new Date(Date.UTC(year, d.getUTCMonth(), d.getUTCDate() + 1));
  const ny = next.getUTCFullYear();
  const nm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(next.getUTCDate()).padStart(2, '0');
  return {
    start: `${year}-${month}-${day} 00:00:00+00`,
    end: `${ny}-${nm}-${nd} 00:00:00+00`,
    suffix: `${year}${month}${day}`,
  };
}

/** Creates + attaches the daily partition covering `dayOffset` (UTC). */
async function createDayPartition(client: DbClient, schema: string, table: string, dayOffset: number): Promise<string> {
  const { start, end, suffix } = dayBounds(dayAt(dayOffset));
  const child = `${table}_p${suffix}`;
  await client.none(
    `CREATE TABLE IF NOT EXISTS ${quoted(schema)}.${quoted(child)} (LIKE ${quoted(schema)}.${quoted(table)} INCLUDING ALL)`,
  );
  await client.none(
    `ALTER TABLE ${quoted(schema)}.${quoted(table)} ATTACH PARTITION ${quoted(schema)}.${quoted(child)} FOR VALUES FROM ('${start}') TO ('${end}')`,
  );
  return child;
}

/** listPartitions() returns regclass text (schema-qualified); strip to bare child names. */
async function partitionNames(client: DbClient, schema: string, table: string): Promise<string[]> {
  const partitions = await listPartitions(client, schema, table);
  return partitions.map(p => p.split('.').pop()!.replace(/"/g, ''));
}

async function countRows(client: DbClient, schema: string, table: string): Promise<number> {
  const row = await client.one<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${qualifiedTable(schema, table)}`,
  );
  return Number(row.count);
}

function makeSpan(overrides: Partial<Record<string, unknown>> = {}) {
  const startedAt = (overrides.startedAt as Date | undefined) ?? dayAt(0, 10);
  const endedAt = (overrides.endedAt as Date | undefined) ?? new Date(startedAt.getTime() + 1_000);
  return {
    traceId: `trace-${crypto.randomUUID()}`,
    spanId: `span-${crypto.randomUUID()}`,
    name: 'retention-span',
    spanType: SpanType.AGENT_RUN,
    isEvent: false,
    startedAt,
    endedAt,
    serviceName: 'svc-retention',
    environment: 'test',
    tags: ['vnext'],
    ...overrides,
  };
}

function makeMetric(timestamp: Date) {
  return {
    metricId: `metric-${crypto.randomUUID()}`,
    timestamp,
    name: 'mastra_latency_ms',
    value: 1,
    labels: {},
    estimatedCost: 0.01,
    costUnit: 'usd',
    tags: ['vnext'],
  };
}

function makeLog(timestamp: Date) {
  return {
    logId: `log-${crypto.randomUUID()}`,
    timestamp,
    level: 'info' as const,
    message: 'retention-log',
    data: null,
    tags: ['vnext'],
  };
}

function makeScore(timestamp: Date) {
  return {
    scoreId: `score-${crypto.randomUUID()}`,
    timestamp,
    traceId: `score-trace-${crypto.randomUUID()}`,
    spanId: null,
    scorerId: 'quality',
    score: 0.5,
    reason: null,
    tags: ['vnext'],
  };
}

describe('ObservabilityStoragePostgresVNext — retention (native partitions)', () => {
  const schema = `obs_retention_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
  let pool: Pool;
  let client: DbClient;
  let domain: ObservabilityStoragePostgresVNext;

  beforeAll(async () => {
    pool = new Pool({ connectionString, max: 2 });
    client = new PoolAdapter(pool);
    await client.none(`CREATE SCHEMA IF NOT EXISTS ${quoted(schema)}`);
    domain = new ObservabilityStoragePostgresVNext({ client, schemaName: schema });
    await domain.init();
    expect(domain.partitionMode).toBe('native');
  });

  afterAll(async () => {
    try {
      await client.none(`DROP SCHEMA IF EXISTS ${quoted(schema)} CASCADE`);
    } finally {
      await pool.end();
    }
  });

  it('drops aged span partitions whole, keeps fresh data, and skips tables without a policy', async () => {
    const oldDay = await createDayPartition(client, schema, TABLE_SPAN_EVENTS, -40);
    const olderDay = await createDayPartition(client, schema, TABLE_SPAN_EVENTS, -35);

    await domain.batchCreateSpans({
      records: [
        makeSpan({ startedAt: dayAt(-40, 9), endedAt: dayAt(-40, 10) }),
        makeSpan({ startedAt: dayAt(-40, 10), endedAt: dayAt(-40, 11) }),
        makeSpan({ startedAt: dayAt(-35, 9), endedAt: dayAt(-35, 10) }),
      ],
    });
    await domain.createSpan({ span: makeSpan() }); // today — must survive

    const partitionsBefore = await partitionNames(client, schema, TABLE_SPAN_EVENTS);
    expect(partitionsBefore).toContain(oldDay);
    expect(partitionsBefore).toContain(olderDay);

    const results = await domain.prune({ spans: { maxAge: '30d' } });

    expect(results).toEqual([{ domain: 'observability', table: TABLE_SPAN_EVENTS, deleted: 3, done: true }]);

    const partitionsAfter = await partitionNames(client, schema, TABLE_SPAN_EVENTS);
    expect(partitionsAfter).not.toContain(oldDay);
    expect(partitionsAfter).not.toContain(olderDay);
    // Pre-created today/future partitions are untouched.
    expect(partitionsAfter.length).toBe(partitionsBefore.length - 2);
    expect(await countRows(client, schema, TABLE_SPAN_EVENTS)).toBe(1);
  });

  it('keeps partitions that are not wholly older than the cutoff, then drops them once aged out', async () => {
    const day = await createDayPartition(client, schema, TABLE_METRIC_EVENTS, -20);
    await domain.batchCreateMetrics({ metrics: [makeMetric(dayAt(-20, 9)), makeMetric(dayAt(-20, 10))] });

    // Cutoff (now - 25d) is before the partition's upper bound: kept.
    const kept = await domain.prune({ metrics: { maxAge: '25d' } });
    expect(kept).toEqual([{ domain: 'observability', table: TABLE_METRIC_EVENTS, deleted: 0, done: true }]);
    expect(await partitionNames(client, schema, TABLE_METRIC_EVENTS)).toContain(day);

    // Tighter policy ages the whole day out: dropped.
    const dropped = await domain.prune({ metrics: { maxAge: '10d' } });
    expect(dropped).toEqual([{ domain: 'observability', table: TABLE_METRIC_EVENTS, deleted: 2, done: true }]);
    expect(await partitionNames(client, schema, TABLE_METRIC_EVENTS)).not.toContain(day);
  });

  it('respects maxBatches (one partition per batch) and resumes on the next call', async () => {
    await createDayPartition(client, schema, TABLE_LOG_EVENTS, -50);
    await createDayPartition(client, schema, TABLE_LOG_EVENTS, -45);
    await domain.batchCreateLogs({ logs: [makeLog(dayAt(-50, 9)), makeLog(dayAt(-45, 9))] });

    const first = await domain.prune({ logs: { maxAge: '30d' } }, { maxBatches: 1 });
    expect(first).toEqual([{ domain: 'observability', table: TABLE_LOG_EVENTS, deleted: 1, done: false }]);

    const second = await domain.prune({ logs: { maxAge: '30d' } });
    expect(second).toEqual([{ domain: 'observability', table: TABLE_LOG_EVENTS, deleted: 1, done: true }]);
    expect(await countRows(client, schema, TABLE_LOG_EVENTS)).toBe(0);
  });

  it('an aborted signal stops before any partition is dropped', async () => {
    const day = await createDayPartition(client, schema, TABLE_SCORE_EVENTS, -60);
    await domain.createScore({ score: makeScore(dayAt(-60, 9)) });

    const controller = new AbortController();
    controller.abort();

    const results = await domain.prune({ scores: { maxAge: '30d' } }, { signal: controller.signal });
    expect(results).toEqual([{ domain: 'observability', table: TABLE_SCORE_EVENTS, deleted: 0, done: false }]);
    expect(await partitionNames(client, schema, TABLE_SCORE_EVENTS)).toContain(day);
    expect(await countRows(client, schema, TABLE_SCORE_EVENTS)).toBe(1);
  });

  it('never drops empty pre-created current/future partitions', async () => {
    const before = await partitionNames(client, schema, TABLE_SCORE_EVENTS);

    // Everything older than 1 day is eligible, but the only aged partition is
    // the one from the abort test — prune it and confirm nothing else goes.
    const results = await domain.prune({ scores: { maxAge: '30d' } });
    expect(results).toEqual([{ domain: 'observability', table: TABLE_SCORE_EVENTS, deleted: 1, done: true }]);

    const after = await partitionNames(client, schema, TABLE_SCORE_EVENTS);
    expect(after.length).toBe(before.length - 1);
    // Yesterday + today + future window all survive.
    for (const name of after) {
      expect(before).toContain(name);
    }
  });
});
