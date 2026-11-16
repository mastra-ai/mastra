import { createPreviewTests } from '@internal/storage-test-utils';
import { SpanType } from '@mastra/core/observability';
import { parseTraceQueryRequest, planSpanQuery, planThreadRowsQuery, planTraceQuery } from '@mastra/core/storage';
import type { CreateSpanRecord, ObservabilityStorage } from '@mastra/core/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DuckDBStore } from '../../../index';

const store = new DuckDBStore({ path: ':memory:' });
let storage: ObservabilityStorage;

beforeAll(async () => {
  storage = (await store.getStore('observability'))!;
  await storage.init();
});
afterAll(() => store.close());

/** Clears a span's stored previews, leaving its event rows as the writer wrote them before previews. */
async function clearPreviews(traceId: string, spanId: string): Promise<void> {
  await store.db.execute(
    `UPDATE span_events SET inputPreview = NULL, outputPreview = NULL, errorPreview = NULL,
       hasInputPayload = NULL, hasOutputPayload = NULL, hasErrorPayload = NULL
     WHERE traceId = ? AND spanId = ?`,
    [traceId, spanId],
  );
}

createPreviewTests(() => storage, {
  // Same start/end event rows the writer produced before it stored previews: payloads set,
  // preview columns NULL.
  writeSpanWithoutPreviews: async span => {
    await storage.batchCreateSpans({ records: [span] });
    await clearPreviews(span.traceId, span.spanId);
  },
});

describe('DuckDB stored previews', () => {
  const startedAt = new Date('2026-05-01T12:00:00Z');
  const endedAt = new Date('2026-05-01T12:00:01Z');
  const timeRange = { from: '2026-05-01T00:00:00.000Z', to: '2026-05-02T00:00:00.000Z' };
  const span = (extra: Partial<CreateSpanRecord> = {}): CreateSpanRecord => ({
    traceId: 'trace-rows',
    spanId: 'root-rows',
    parentSpanId: null,
    name: 'root',
    spanType: SpanType.AGENT_RUN,
    isEvent: false,
    startedAt,
    endedAt,
    input: 'the input',
    output: 'the output',
    error: null,
    ...extra,
  });
  const rowsOf = (spanId: string) =>
    store.db.query<{
      eventType: string;
      inputPreview: string | null;
      outputPreview: string | null;
      errorPreview: string | null;
    }>(
      `SELECT eventType, inputPreview, outputPreview, errorPreview FROM span_events
       WHERE spanId = ? ORDER BY cursorId`,
      [spanId],
    );

  beforeEach(async () => {
    await storage.dangerouslyClearAll();
  });

  it('writes all three previews on every event row', async () => {
    // Live span: the start row carries the input, the end row carries every payload. A row that
    // does not carry a payload stores '' for it, so NULL only ever marks a row from before previews.
    await storage.batchCreateSpans({ records: [span({ endedAt: null })] });
    await storage.batchCreateSpans({ records: [span()] });

    expect(await rowsOf('root-rows')).toEqual([
      { eventType: 'start', inputPreview: 'the input', outputPreview: '', errorPreview: '' },
      // A completed record keeps its payload on the end row only.
      { eventType: 'start', inputPreview: '', outputPreview: '', errorPreview: '' },
      { eventType: 'end', inputPreview: 'the input', outputPreview: 'the output', errorPreview: '' },
    ]);
  });

  it('uses the stored previews once any event row of a span has them', async () => {
    // Upgraded mid-span: the start row predates previews, the end row stores them.
    await storage.batchCreateSpans({ records: [span({ endedAt: null })] });
    await clearPreviews('trace-rows', 'root-rows');
    await storage.batchCreateSpans({ records: [span({ output: { text: 'later output' } })] });

    const { spans } = await storage.listTracesLight({ pagination: { page: 0, perPage: 10 } });
    expect(spans.map(s => [s.inputPreview, s.outputPreview, s.errorPreview])).toEqual([
      ['the input', 'later output', null],
    ]);
  });

  it('keeps the older payload preview when an upgraded end row carries no payload', async () => {
    await storage.batchCreateSpans({ records: [span({ endedAt: null })] });
    await clearPreviews('trace-rows', 'root-rows');
    await storage.batchCreateSpans({ records: [span({ input: null })] });

    const { spans } = await storage.listTracesLight({ pagination: { page: 0, perPage: 10 } });
    expect(spans[0]!.inputPreview).toBe('the input');
  });

  async function columnsScannedBy(read: () => Promise<void>): Promise<string[][]> {
    const query = vi.spyOn(store.db, 'query');
    let calls: unknown[][];
    try {
      await read();
      calls = query.mock.calls.slice();
    } finally {
      query.mockRestore();
    }
    type PlanNode = { name?: string; extra_info?: { Projections?: string | string[] }; children?: PlanNode[] };
    const scans = (node: PlanNode): string[][] => [
      ...(node.name?.includes('SCAN') && node.extra_info?.Projections ? [[node.extra_info.Projections].flat()] : []),
      ...(node.children ?? []).flatMap(scans),
    ];
    const scanned: string[][] = [];
    for (const [sql, params] of calls) {
      const [plan] = await store.db.query<{ explain_value: string }>(
        `EXPLAIN (FORMAT JSON) ${sql}`,
        params as unknown[],
      );
      scanned.push(...(JSON.parse(plan!.explain_value) as PlanNode[]).flatMap(scans));
    }
    return scanned;
  }

  it('lists traces without scanning the input or output payloads', async () => {
    await storage.batchCreateSpans({ records: [span({ endedAt: null })] });
    await storage.batchCreateSpans({ records: [span()] });

    const scanned = await columnsScannedBy(async () => {
      const { spans } = await storage.listTracesLight({ pagination: { page: 0, perPage: 10 } });
      expect(spans[0]).toMatchObject({ inputPreview: 'the input', outputPreview: 'the output' });
    });

    expect(scanned.some(columns => columns.includes('inputPreview'))).toBe(true);
    expect(scanned.flat()).not.toContain('input');
    expect(scanned.flat()).not.toContain('output');
  });

  it('queries spans without scanning the payloads when every preview is stored', async () => {
    await storage.batchCreateSpans({ records: [span({ endedAt: null })] });
    await storage.batchCreateSpans({ records: [span()] });

    const scanned = await columnsScannedBy(async () => {
      const { spans } = await storage.querySpans(planSpanQuery({ timeRange }));
      expect(spans[0]).toMatchObject({ inputPreview: 'the input', outputPreview: 'the output' });
    });

    expect(scanned.flat()).not.toContain('input');
    expect(scanned.flat()).not.toContain('output');
    const previewLookup = scanned.find(columns => columns.includes('inputPreview'));
    expect(previewLookup).not.toContain('error');
  });

  it('queries threads without scanning the input or output payloads when every preview is stored', async () => {
    await storage.batchCreateSpans({ records: [span({ threadId: 'thread-rows', endedAt: null })] });
    await storage.batchCreateSpans({ records: [span({ threadId: 'thread-rows' })] });

    const scanned = await columnsScannedBy(async () => {
      const { threads } = await storage.queryThreads(planThreadRowsQuery({ timeRange: { traces: timeRange } }));
      expect(threads[0]).toMatchObject({ inputPreview: 'the input', outputPreview: 'the output' });
    });

    expect(scanned.some(columns => columns.includes('inputPreview'))).toBe(true);
    expect(scanned.flat()).not.toContain('input');
    expect(scanned.flat()).not.toContain('output');
  });

  it('keeps an upstream preview recorded without a payload', async () => {
    await storage.batchCreateSpans({ records: [span({ input: null, inputPreview: 'upstream input' })] });

    const { spans } = await storage.listTracesLight({ pagination: { page: 0, perPage: 10 } });
    expect(spans[0]!.inputPreview).toBe('upstream input');
  });

  it('keeps empty sentinels when no event carries a payload, without fetching payloads', async () => {
    await storage.batchCreateSpans({ records: [span({ input: null, output: null, error: null })] });
    const query = vi.spyOn(store.db, 'query');
    try {
      const { spans } = await storage.listTracesLight({ pagination: { page: 0, perPage: 10 } });
      expect(spans[0]).toMatchObject({ inputPreview: null, outputPreview: null, errorPreview: null });
      expect(query.mock.calls.some(([sql]) => sql.includes('arg_max(input,'))).toBe(false);
    } finally {
      query.mockRestore();
    }
  });

  it('does not keep an older preview when a newer payload is blank or has no stored preview', async () => {
    await storage.batchCreateSpans({ records: [span({ endedAt: null, input: 'old input' })] });
    await storage.batchCreateSpans({ records: [span({ input: '   ' })] });
    const blank = await storage.listTracesLight({ pagination: { page: 0, perPage: 10 } });
    expect(blank.spans[0]!.inputPreview).toBeNull();

    await store.db.execute(`UPDATE span_events SET input = '"new input"', inputPreview = NULL WHERE eventType = 'end'`);
    const legacy = await storage.listTracesLight({ pagination: { page: 0, perPage: 10 } });
    expect(legacy.spans[0]!.inputPreview).toBe('new input');
    const stored = await store.db.query<{ inputPreview: string | null }>(
      `SELECT inputPreview FROM span_events WHERE eventType = 'end'`,
    );
    expect(stored[0]!.inputPreview).toBeNull();
  });

  it('adds the preview columns to an existing span_events table', async () => {
    const legacy = new DuckDBStore({ path: ':memory:' });
    try {
      await legacy.db.execute(`
        CREATE TABLE span_events (
          eventType VARCHAR NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          traceId VARCHAR NOT NULL,
          spanId VARCHAR NOT NULL,
          parentSpanId VARCHAR,
          input JSON,
          output JSON,
          error JSON
        )
      `);
      await legacy.db.execute(
        `INSERT INTO span_events (eventType, timestamp, traceId, spanId, input)
         VALUES ('start', '2026-05-01 12:00:00', 'legacy-trace', 'legacy-span', '"legacy input"')`,
      );
      const observability = (await legacy.getStore('observability'))!;
      await observability.init();

      const columns = await legacy.db.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'span_events' AND column_name LIKE '%Preview' ORDER BY column_name`,
      );
      expect(columns.map(c => c.column_name)).toEqual(['errorPreview', 'inputPreview', 'outputPreview']);
      const flags = await legacy.db.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'span_events' AND column_name LIKE 'has%Payload' ORDER BY column_name`,
      );
      expect(flags.map(c => c.column_name)).toEqual(['hasErrorPayload', 'hasInputPayload', 'hasOutputPayload']);
      const rows = await legacy.db.query<{ inputPreview: string | null }>(`SELECT inputPreview FROM span_events`);
      expect(rows).toEqual([{ inputPreview: null }]);
    } finally {
      await legacy.close();
    }
  });
});

describe('DuckDB payload lookups on a large span_events table', () => {
  const big = new DuckDBStore({ path: ':memory:' });
  let observability: ObservabilityStorage;
  const pageRange = { from: '2026-05-01T00:00:00.000Z', to: '2026-05-02T00:00:00.000Z' };
  const FILLER_ROWS = 300_000;
  const root = (id: string, startedAt: Date): CreateSpanRecord => ({
    traceId: id,
    spanId: id,
    parentSpanId: null,
    name: 'root',
    spanType: SpanType.AGENT_RUN,
    isEvent: false,
    threadId: 'thread-page',
    startedAt,
    endedAt: new Date(startedAt.getTime() + 30_000),
    input: `input ${id}`,
    output: `output ${id}`,
    error: null,
  });

  beforeAll(async () => {
    observability = (await big.getStore('observability'))!;
    await observability.init();
    // A chat that began before the filler and continues on the page, so its first trace is in the oldest row group.
    await observability.batchCreateSpans({ records: [root('abcdef9', new Date(Date.UTC(2025, 11, 31, 12)))] });
    await big.db.execute(
      `INSERT INTO span_events (eventType, timestamp, cursorId, traceId, spanId, name, spanType, isEvent, endedAt, input, output)
       SELECT 'end', ts, i, md5(i::VARCHAR), md5('span' || i), 'old', 'agent_run', false, ts, '"old"', '"old"'
       FROM (SELECT i, TIMESTAMP '2026-01-01 00:00:00' + INTERVAL (i) SECOND AS ts FROM range(${FILLER_ROWS}) r(i))`,
    );
    // Random-looking ids and distinct times, as in real data. Otherwise DuckDB prunes on the ids'
    // prefixes, or factors a time shared by every key tuple out of the OR, and no range is needed.
    await observability.batchCreateSpans({
      records: [0, 1].map(i => root(`abcdef${i}`, new Date(Date.UTC(2026, 4, 1, 12, i)))),
    });
    await big.db.execute(
      `UPDATE span_events SET inputPreview = NULL, outputPreview = NULL, errorPreview = NULL,
         hasInputPayload = NULL, hasOutputPayload = NULL, hasErrorPayload = NULL
       WHERE traceId LIKE 'abcdef%'`,
    );
  });
  afterAll(() => big.close());

  /** Runs a store read, then re-runs its payload lookup to count the rows DuckDB read from the table. */
  async function lookupRowsScanned(read: () => Promise<unknown>): Promise<number> {
    const query = vi.spyOn(big.db, 'query');
    await read();
    const calls = query.mock.calls.slice();
    query.mockRestore();
    const lookup = calls.find(([sql]) => /NULLIF\(input|arg_max\(input,/.test(sql));
    if (!lookup) throw new Error('Expected the read to run a payload lookup');
    const [plan] = await big.db.query<{ explain_value: string }>(
      `EXPLAIN (ANALYZE, FORMAT JSON) ${lookup[0]}`,
      lookup[1] as unknown[],
    );
    const scanned = (node: { operator_rows_scanned?: number; children?: object[] }): number =>
      (node.operator_rows_scanned ?? 0) + (node.children ?? []).reduce((sum: number, child) => sum + scanned(child), 0);
    return scanned(JSON.parse(plan!.explain_value));
  }

  it.each<[string, () => Promise<unknown>]>([
    [
      'queryTraces',
      () =>
        observability.queryTraces(
          planTraceQuery(parseTraceQueryRequest({ timeRange: pageRange, pagination: { page: 0, perPage: 10 } })),
        ),
    ],
    [
      'listTracesLight',
      () =>
        observability.listTracesLight({
          filters: { startedAt: { start: new Date(pageRange.from), end: new Date(pageRange.to) } },
          pagination: { page: 0, perPage: 10 },
        }),
    ],
    ['querySpans', () => observability.querySpans(planSpanQuery({ timeRange: pageRange }))],
    ['queryThreads', () => observability.queryThreads(planThreadRowsQuery({ timeRange: { traces: pageRange } }))],
  ])('%s reads only the row groups that hold the page', async (_name, read) => {
    expect(await lookupRowsScanned(read)).toBeLessThan((FILLER_ROWS * 2) / 3);
  });
});
