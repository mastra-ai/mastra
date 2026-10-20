import { randomUUID } from 'node:crypto';
import { createClient } from '@clickhouse/client';
import type { ClickHouseClient } from '@clickhouse/client';
import { createPreviewTests, createSpanQueryTests, createThreadQueryTests } from '@internal/storage-test-utils';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { SpanType } from '@mastra/core/observability';
import {
  planSpanQuery,
  planThreadRowsQuery,
  TraceQueryExecutionError,
  TraceQueryResourceLimitError,
} from '@mastra/core/storage';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TABLE_SPAN_EVENTS, TABLE_TRACE_ROOTS } from './ddl';
import { CH_INSERT_SETTINGS, spanRecordToRow } from './helpers';
import * as threadQueryOps from './thread-query';
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
createSpanQueryTests(() => storage, { completionOnly: true, immutableStartedAt: true });
it('keeps completed threads visible before pending and completed root copies merge', async () => {
  await storage.dangerouslyClearAll();
  await client.command({ query: `SYSTEM STOP MERGES ${TABLE_TRACE_ROOTS}` });
  try {
    const startedAt = new Date();
    const endedAt = new Date(startedAt.getTime() + 1000);
    const plan = planThreadRowsQuery({
      timeRange: { traces: { from: startedAt.toISOString(), to: new Date(endedAt.getTime() + 1000).toISOString() } },
    });
    // Repeated public writes reproduce the nondeterministic tie reported in PR #27652.
    for (let index = 0; index < 40; index++) {
      const span = {
        traceId: `late-context-${index}`,
        spanId: 'root',
        parentSpanId: null,
        name: 'agent',
        spanType: SpanType.AGENT_RUN,
        isEvent: false,
        startedAt,
      };
      await storage.batchCreateSpans({ records: [{ ...span, endedAt: null, threadId: null }] });
      await storage.batchCreateSpans({
        records: [
          { ...span, endedAt: index % 2 ? endedAt : startedAt, threadId: `thread-${index}`, output: 'completed' },
        ],
      });
    }
    const copies = await client.query({
      query: `SELECT count() AS count FROM ${TABLE_TRACE_ROOTS}`,
      format: 'JSONEachRow',
    });
    expect(Number((await copies.json<{ count: string | number }>())[0]!.count)).toBe(80);
    for (let round = 0; round < 40; round++) {
      const result = await storage.queryThreads(plan);
      expect(result.threads).toHaveLength(40);
      expect(result.threads.every(row => row.traceCount === 1 && row.outputPreview === 'completed')).toBe(true);
    }
  } finally {
    await client.command({ query: `SYSTEM START MERGES ${TABLE_TRACE_ROOTS}` });
  }
});
const runThreadRows = threadQueryOps.queryThreadRows;
it.each([null, 'org-a'])(
  'returns thread models within a read budget despite older span history (organization %s)',
  async organizationId => {
    await storage.dangerouslyClearAll();
    const startedAt = new Date();
    const endedAt = new Date(startedAt.getTime() + 1000);
    await storage.batchCreateSpans({
      records: [
        {
          organizationId,
          traceId: 'hydration-trace',
          spanId: 'root',
          parentSpanId: null,
          name: 'agent',
          spanType: SpanType.AGENT_RUN,
          isEvent: false,
          threadId: 'thread',
          startedAt,
          endedAt,
        },
        {
          organizationId,
          traceId: 'hydration-trace',
          spanId: 'model',
          parentSpanId: 'root',
          name: 'model',
          spanType: SpanType.MODEL_GENERATION,
          isEvent: false,
          startedAt,
          endedAt,
          attributes: { model: 'gpt-4o', provider: 'openai' },
        },
      ],
    });
    // Old model spans share the trace identity but cannot supply the selected root's model.
    // A read budget detects scanning their partition without depending on wall-clock timing.
    await client.command({
      query: `INSERT INTO ${TABLE_SPAN_EVENTS}
        (organizationId, traceId, spanId, parentSpanId, dedupeKey, name, spanType, startedAt, endedAt)
        SELECT {org:Nullable(String)}, 'hydration-trace', concat('old-',toString(number)), 'other-root',
          concat('old-',toString(number)), 'model', 'model_generation',
          now64(3) - INTERVAL 30 DAY, now64(3) - INTERVAL 30 DAY FROM numbers(100000)`,
      query_params: { org: organizationId },
    });
    const limitedClient = createClient({
      ...config,
      database,
      clickhouse_settings: { max_rows_to_read: '50000' },
    });
    const limitedStorage = new ObservabilityStorageClickhouseVNext({ client: limitedClient });
    try {
      const result = await limitedStorage.queryThreads(
        planThreadRowsQuery({
          timeRange: { traces: { from: startedAt.toISOString(), to: endedAt.toISOString() } },
        }),
      );
      expect(result.threads).toHaveLength(1);
      expect(result.threads[0]).toMatchObject({
        organizationId,
        threadId: 'thread',
        traceCount: 1,
        model: 'gpt-4o',
        provider: 'openai',
      });
    } finally {
      await limitedClient.close();
    }
  },
);
it('rejects broad queries over large histories while allowing narrow queries and smaller scopes', async () => {
  await storage.dangerouslyClearAll();
  await client.command({
    query: `INSERT INTO ${TABLE_TRACE_ROOTS}
      (organizationId, traceId, spanId, dedupeKey, threadId, startedAt, endedAt, inputPreview, outputPreview, errorPreview)
      SELECT 'large', concat('trace-', toString(number)), 'root', concat('key-', toString(number)),
        concat('thread-', toString(intDiv(number, 5))),
        toDateTime64('2026-01-01 00:00:00', 3, 'UTC') + toIntervalSecond(number),
        toDateTime64('2026-01-01 00:00:01', 3, 'UTC') + toIntervalSecond(number), '', '', ''
      FROM numbers(250001) SETTINGS max_threads=2, max_insert_threads=1`,
  });
  const broad = { timeRange: { traces: { from: '2026-01-01T00:00:00Z', to: '2026-01-08T00:00:00Z' } } };
  await expect(
    storage.queryThreads(planThreadRowsQuery(broad, { scope: { organizationId: 'large' } })),
  ).rejects.toBeInstanceOf(TraceQueryResourceLimitError);
  const narrow = await storage.queryThreads(
    planThreadRowsQuery(
      { timeRange: { traces: { from: '2026-01-01T00:00:01Z', to: '2026-01-01T01:00:00Z' } } },
      { scope: { organizationId: 'large' } },
    ),
  );
  expect(narrow.threads).toHaveLength(100);
  expect(narrow.threads.every(row => row.traceCount === 5)).toBe(true);
  await storage.batchCreateSpans({
    records: [
      {
        traceId: 'small-trace',
        spanId: 'root',
        parentSpanId: null,
        name: 'agent',
        spanType: SpanType.AGENT_RUN,
        isEvent: false,
        organizationId: 'small',
        threadId: 'small-thread',
        startedAt: new Date('2026-01-01T00:00:00Z'),
        endedAt: new Date('2026-01-01T00:00:01Z'),
      },
    ],
  });
  const forceFull = vi
    .spyOn(threadQueryOps, 'queryThreadRows')
    .mockImplementation((client, plan, timeoutMs) => runThreadRows(client, plan, timeoutMs, 'full'));
  try {
    const small = await storage.queryThreads(planThreadRowsQuery(broad, { scope: { organizationId: 'small' } }));
    expect(small.threads).toHaveLength(1);
    expect(small.threads[0]).toMatchObject({ threadId: 'small-thread', traceCount: 1 });
  } finally {
    forceFull.mockRestore();
  }
});
describe.each(['auto', 'candidates', 'full'] as const)('thread strategy: %s', strategy => {
  beforeEach(async () => {
    // Keep the public storage API and real SQL execution; override only plan selection.
    vi.spyOn(threadQueryOps, 'queryThreadRows').mockImplementation((client, plan, timeoutMs) =>
      runThreadRows(client, plan, timeoutMs, strategy),
    );
    await client.command({ query: `SYSTEM STOP MERGES ${TABLE_TRACE_ROOTS}` });
  });
  afterEach(async () => {
    vi.mocked(threadQueryOps.queryThreadRows).mockRestore();
    await client.command({ query: `SYSTEM START MERGES ${TABLE_TRACE_ROOTS}` });
  });
  createThreadQueryTests(() => storage, {
    writeSpanWithoutPreviews: async span => {
      await client.insert({
        table: TABLE_SPAN_EVENTS,
        values: [{ ...spanRecordToRow(span), inputPreview: null, outputPreview: null, errorPreview: null }],
        format: 'JSONEachRow',
        clickhouse_settings: CH_INSERT_SETTINGS,
      });
    },
  });
});
createPreviewTests(() => storage, {
  // The row as the writer stored it before the preview columns existed.
  writeSpanWithoutPreviews: async span => {
    await client.insert({
      table: TABLE_SPAN_EVENTS,
      values: [{ ...spanRecordToRow(span), inputPreview: null, outputPreview: null, errorPreview: null }],
      format: 'JSONEachRow',
      clickhouse_settings: CH_INSERT_SETTINGS,
    });
  },
});

it('batches legacy payload reads while preserving stored previews and pagination', async () => {
  await storage.dangerouslyClearAll();
  const startedAt = new Date('2026-01-01T00:00:00Z');
  const endedAt = new Date('2026-01-01T00:00:01Z');
  await client.insert({
    table: TABLE_SPAN_EVENTS,
    values: Array.from({ length: 72 }, (_, index) => ({
      ...spanRecordToRow({
        traceId: 'batch-trace',
        spanId: `span-${String(index).padStart(3, '0')}`,
        parentSpanId: null,
        name: 'legacy',
        spanType: SpanType.AGENT_RUN,
        isEvent: false,
        startedAt,
        endedAt,
        input: `input ${index}`,
        output: `output ${index}`,
        error: null,
      }),
      inputPreview: index === 0 ? '' : index === 1 ? 'supplied' : null,
      outputPreview: index === 0 ? '' : null,
      errorPreview: index === 0 ? '' : null,
    })),
    format: 'JSONEachRow',
    clickhouse_settings: CH_INSERT_SETTINGS,
  });
  const request = {
    timeRange: { from: startedAt.toISOString(), to: '2026-01-02T00:00:00Z' },
    page: { limit: 71 },
  };
  const query = vi.spyOn(client, 'query');
  try {
    const result = await storage.querySpans(planSpanQuery(request));
    const reads = query.mock.calls
      .map(([args]) => args)
      .filter(args => /any\(tuple\(input, output, error\)\)/.test(args.query));
    expect(reads.map(args => (args.query_params!.page as unknown[]).length)).toEqual([32, 32, 6]);
    expect(result.spans).toHaveLength(71);
    expect(result.spans[0]).toMatchObject({ inputPreview: null, outputPreview: null, errorPreview: null });
    expect(result.spans[1]).toMatchObject({ inputPreview: 'supplied', outputPreview: 'output 1' });
    expect(result.spans.slice(1).map(span => span.outputPreview)).toEqual(
      Array.from({ length: 70 }, (_, index) => `output ${index + 1}`),
    );
    expect(result.page.next).not.toBeNull();
    const next = await storage.querySpans(planSpanQuery({ ...request, page: { limit: 71, after: result.page.next! } }));
    expect(next.spans).toHaveLength(1);
    expect(next.spans[0]).toMatchObject({ spanId: 'span-071', outputPreview: 'output 71' });
    expect(next.page.next).toBeNull();
  } finally {
    query.mockRestore();
  }
});

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
