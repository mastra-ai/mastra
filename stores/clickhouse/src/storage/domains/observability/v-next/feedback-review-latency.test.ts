import { randomUUID } from 'node:crypto';
import { createClient } from '@clickhouse/client';
import type { ClickHouseClient } from '@clickhouse/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FEEDBACK_EVENTS_DDL, TABLE_FEEDBACK_EVENTS, DELETION_REQUESTS_DDL } from './ddl';
import { createFeedback, updateFeedbackReviewStatus } from './feedback';

const DAY = 86_400_000;
const PARTITIONS = 180;

// Mutations visit every active part, so their cost grows with table age.
// Review updates must stay independent of the part count.
describe('feedback review latency on an aged table', () => {
  const config = {
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USERNAME || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || 'password',
    clickhouse_settings: { async_insert: 0 as const },
  };
  let admin: ClickHouseClient;
  let client: ClickHouseClient;
  let database: string;

  beforeEach(async () => {
    admin = createClient(config);
    database = `feedback_latency_${randomUUID().replaceAll('-', '')}`;
    await admin.command({ query: `CREATE DATABASE ${database}` });
    client = createClient({ ...config, database });
    await client.command({ query: FEEDBACK_EVENTS_DDL });
    await client.command({ query: DELETION_REQUESTS_DDL });
  }, 60_000);

  afterEach(async () => {
    await client.close();
    await admin.command({ query: `DROP DATABASE ${database} SYNC` });
    await admin.close();
  }, 60_000);

  it(`updates review status without a mutation across ${PARTITIONS} daily partitions`, async () => {
    await client.command({ query: `SYSTEM STOP MERGES ${TABLE_FEEDBACK_EVENTS}` });
    const start = Date.parse('2026-01-01T00:00:00Z');
    for (let day = 0; day < PARTITIONS; day++) {
      await createFeedback(client, {
        feedback: {
          feedbackId: day === 0 ? 'target' : `feedback-${day}`,
          timestamp: new Date(start + day * DAY),
          traceId: `trace-${day}`,
          feedbackSource: 'user',
          feedbackType: 'rating',
          value: 1,
        },
      });
    }
    const parts = await client.query({
      query: `SELECT count() AS parts FROM system.parts WHERE database = currentDatabase() AND table = '${TABLE_FEEDBACK_EVENTS}' AND active`,
      format: 'JSONEachRow',
    });
    expect(Number(((await parts.json()) as Array<{ parts: string }>)[0]?.parts)).toBe(PARTITIONS);

    // One part per partition leaves nothing to merge. Mutations need the merge pool.
    await client.command({ query: `SYSTEM START MERGES ${TABLE_FEEDBACK_EVENTS}` });
    const began = performance.now();
    await expect(
      updateFeedbackReviewStatus(client, { feedbackId: 'target', reviewStatus: 'reviewed' }),
    ).resolves.toMatchObject({ reviewStatus: 'reviewed' });
    const elapsed = performance.now() - began;

    const mutations = await client.query({
      query: `SELECT count() AS mutations FROM system.mutations WHERE database = currentDatabase()`,
      format: 'JSONEachRow',
    });
    expect(Number(((await mutations.json()) as Array<{ mutations: string }>)[0]?.mutations)).toBe(0);
    // A mutation took about 6 s at this part count; inserts take tens of ms.
    expect(elapsed).toBeLessThan(2_000);
  }, 120_000);
});
