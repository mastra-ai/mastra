import { randomUUID } from 'node:crypto';
import { createSpanQueryTests } from '@internal/storage-test-utils';
import { planSpanQuery } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PoolAdapter } from '../../../client';
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
