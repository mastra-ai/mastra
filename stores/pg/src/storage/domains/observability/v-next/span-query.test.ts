import { randomUUID } from 'node:crypto';
import { createSpanQueryTests } from '@internal/storage-test-utils';
import { planSpanQuery } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PoolAdapter } from '../../../client';
import { compilePostgresSpanQuery } from './span-query';
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
