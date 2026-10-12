import { createPreviewTests } from '@internal/storage-test-utils';
import { SpanType } from '@mastra/core/observability';
import type { CreateSpanRecord, ObservabilityStorage } from '@mastra/core/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
    `UPDATE span_events SET inputPreview = NULL, outputPreview = NULL, errorPreview = NULL
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

  it('sets a preview only on the event rows that carry its payload', async () => {
    // Live span: the start row carries the input, the end row carries every payload.
    await storage.batchCreateSpans({ records: [span({ endedAt: null })] });
    await storage.batchCreateSpans({ records: [span()] });

    expect(await rowsOf('root-rows')).toEqual([
      { eventType: 'start', inputPreview: 'the input', outputPreview: null, errorPreview: null },
      // A completed record keeps its payload on the end row only.
      { eventType: 'start', inputPreview: null, outputPreview: null, errorPreview: null },
      { eventType: 'end', inputPreview: 'the input', outputPreview: 'the output', errorPreview: '' },
    ]);
  });

  it('takes each preview from the event row that supplies its payload', async () => {
    // The start row (written before previews) holds the only input; the newer end row carries none.
    await storage.batchCreateSpans({ records: [span({ endedAt: null })] });
    await clearPreviews('trace-rows', 'root-rows');
    await storage.batchCreateSpans({ records: [span({ input: null })] });

    const { spans } = await storage.listTracesLight({ pagination: { page: 0, perPage: 10 } });
    expect(spans.map(s => [s.inputPreview, s.outputPreview, s.errorPreview])).toEqual([
      ['the input', 'the output', null],
    ]);
  });

  it('keeps an upstream preview recorded without a payload', async () => {
    await storage.batchCreateSpans({ records: [span({ input: null, inputPreview: 'upstream input' })] });

    const { spans } = await storage.listTracesLight({ pagination: { page: 0, perPage: 10 } });
    expect(spans[0]!.inputPreview).toBe('upstream input');
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
      const rows = await legacy.db.query<{ inputPreview: string | null }>(`SELECT inputPreview FROM span_events`);
      expect(rows).toEqual([{ inputPreview: null }]);
    } finally {
      await legacy.close();
    }
  });
});
