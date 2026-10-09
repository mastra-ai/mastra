import { randomUUID } from 'node:crypto';
import { createClient } from '@clickhouse/client';
import type { ClickHouseClient } from '@clickhouse/client';
import { createSpanQueryTests } from '@internal/storage-test-utils';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { planSpanQuery, TraceQueryExecutionError, TraceQueryResourceLimitError } from '@mastra/core/storage';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { ObservabilityStorageClickhouseVNext } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });
const database = `span_query_${randomUUID().replaceAll('-', '')}`;
const config = {
  url: process.env.CLICKHOUSE_URL ?? 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USERNAME ?? 'default',
  password: process.env.CLICKHOUSE_PASSWORD ?? 'password',
};
const admin = createClient(config);
const client = createClient({ ...config, database });
const storage = new ObservabilityStorageClickhouseVNext({ client });
beforeAll(async () => {
  await admin.command({ query: `CREATE DATABASE ${database}` });
  await storage.init();
});
afterAll(async () => {
  await client.close();
  await admin.command({ query: `DROP DATABASE ${database} SYNC` });
  await admin.close();
});
createSpanQueryTests(() => storage, { completionOnly: true });

it('wraps unexpected database errors with span-query context', async () => {
  const cause = new Error('Connection refused');
  const query = vi.fn().mockRejectedValue(cause);
  const failingStorage = new ObservabilityStorageClickhouseVNext({ client: { query } as unknown as ClickHouseClient });
  const plan = planSpanQuery({ timeRange: { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' } });

  await expect(failingStorage.querySpans(plan)).rejects.toMatchObject({
    id: 'MASTRA_STORAGE_CLICKHOUSE_QUERY_SPANS_FAILED',
    domain: ErrorDomain.STORAGE,
    category: ErrorCategory.THIRD_PARTY,
    cause,
  });
});

it.each([
  new TraceQueryExecutionError(),
  new TraceQueryResourceLimitError(),
  new MastraError({ id: 'TEST_STORAGE_ERROR', domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }),
])('preserves recognized errors: %s', async error => {
  const query = vi.fn().mockRejectedValue(error);
  const failingStorage = new ObservabilityStorageClickhouseVNext({ client: { query } as unknown as ClickHouseClient });
  const plan = planSpanQuery({ timeRange: { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' } });

  await expect(failingStorage.querySpans(plan)).rejects.toBe(error);
});
