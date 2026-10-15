import { randomUUID } from 'node:crypto';
import { createPreviewTests, createSpanQueryTests } from '@internal/storage-test-utils';
import { SpanType } from '@mastra/core/observability';
import { planSpanQuery } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PoolAdapter } from '../../../client';
import { TABLE_SPAN_EVENTS } from './ddl';
import { spanRecordToRow } from './helpers';
import { compilePostgresSpanQuery } from './span-query';
import { buildInsert } from './sql';
import { ObservabilityStoragePostgresVNext } from './index';

const schemaName = `span_query_${randomUUID().replaceAll('-', '')}`;
const pool = new Pool({
  connectionString: process.env.DB_URL ?? 'postgres://postgres:postgres@localhost:5434/postgres',
});
const client = new PoolAdapter(pool);
const storage = new ObservabilityStoragePostgresVNext({ client, schemaName });
beforeAll(async () => {
  await client.none(`CREATE SCHEMA "${schemaName}"`);
  await storage.init();
}, 60_000);
afterAll(async () => {
  await client.none(`DROP SCHEMA "${schemaName}" CASCADE`);
  await pool.end();
});
createSpanQueryTests(() => storage);
createPreviewTests(() => storage, {
  // A row as written before the preview columns existed: payloads set, previews NULL.
  writeSpanWithoutPreviews: async span => {
    const row = { ...spanRecordToRow(span), inputPreview: null, outputPreview: null, errorPreview: null };
    const insert = buildInsert(schemaName, TABLE_SPAN_EVENTS, [row])!;
    await client.query(insert.text, insert.values);
  },
});

it('adds the preview columns to a span table created before they existed', async () => {
  const columns = () =>
    client.any<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2 AND column_name LIKE '%Preview' ORDER BY column_name`,
      [schemaName, TABLE_SPAN_EVENTS],
    );
  await client.none(
    `ALTER TABLE "${schemaName}".${TABLE_SPAN_EVENTS}
       DROP COLUMN "inputPreview", DROP COLUMN "outputPreview", DROP COLUMN "errorPreview"`,
  );
  expect(await columns()).toEqual([]);
  await new ObservabilityStoragePostgresVNext({ client, schemaName }).init();
  expect((await columns()).map(column => column.column_name)).toEqual([
    'errorPreview',
    'inputPreview',
    'outputPreview',
  ]);
});

it('adds the outside parent column to a span table created before it existed and reads old rows as null', async () => {
  await client.none(`ALTER TABLE "${schemaName}".${TABLE_SPAN_EVENTS} DROP COLUMN "externalParentSpanId"`);
  // A row as written before the column existed, inside the partitions created around today.
  const startedAt = new Date();
  startedAt.setUTCHours(12, 0, 0, 0);
  const { externalParentSpanId: _, ...row } = spanRecordToRow({
    traceId: 'pre-outside-parent',
    spanId: 'pre-outside-parent-root',
    parentSpanId: null,
    name: 'root',
    spanType: SpanType.AGENT_RUN,
    isEvent: false,
    startedAt,
    endedAt: new Date(startedAt.getTime() + 1000),
  });
  const insert = buildInsert(schemaName, TABLE_SPAN_EVENTS, [row])!;
  await client.query(insert.text, insert.values);

  await new ObservabilityStoragePostgresVNext({ client, schemaName }).init();
  const trace = await storage.getTrace({ traceId: 'pre-outside-parent' });
  expect(trace?.spans).toEqual([
    expect.objectContaining({ spanId: 'pre-outside-parent-root', parentSpanId: null, externalParentSpanId: null }),
  ]);
});

it('returns fractional durations when PostgreSQL timestamps retain microseconds', async () => {
  await storage.dangerouslyClearAll();
  const start = new Date();
  start.setUTCHours(12, 0, 0, 0);
  // Insert with SQL because JavaScript Date cannot represent microseconds.
  await client.none(
    `INSERT INTO "${schemaName}".mastra_span_events
      ("traceId", "spanId", name, "spanType", "startedAt", "endedAt")
     VALUES ('precision-trace', 'precision-span', 'tool', 'tool_call',
       $1::timestamptz + interval '0.0001 seconds',
       $1::timestamptz + interval '1.0006 seconds')`,
    [start.toISOString()],
  );
  const result = await storage.querySpans(
    planSpanQuery({
      timeRange: { from: start.toISOString(), to: new Date(start.getTime() + 60_000).toISOString() },
    }),
  );
  expect(result.spans).toHaveLength(1);
  expect(result.spans[0]).toMatchObject({
    spanId: 'precision-span',
    startedAt: start.toISOString(),
    endedAt: new Date(start.getTime() + 1000).toISOString(),
    durationMs: 1000.5,
  });
});

it('reads only partitions that can hold spans from the search window', async () => {
  const from = new Date();
  const query = compilePostgresSpanQuery(
    schemaName,
    planSpanQuery({ timeRange: { from: from.toISOString(), to: new Date(from.getTime() + 60_000).toISOString() } }),
  );
  const plan = await client.any<{ 'QUERY PLAN': string }>(`EXPLAIN ${query.text}`, query.values);
  const partitions = plan.flatMap(row =>
    [...row['QUERY PLAN'].matchAll(/mastra_span_events_p(\d{8})/g)].map(m => m[1]!),
  );
  expect(partitions.length).toBeGreaterThan(0);
  expect(partitions.filter(day => day < from.toISOString().slice(0, 10).replaceAll('-', ''))).toEqual([]);
});
