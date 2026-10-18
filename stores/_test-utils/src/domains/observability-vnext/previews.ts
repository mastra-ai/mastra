import { SpanType } from '@mastra/core/observability';
import {
  buildPreview,
  parseTraceQueryRequest,
  planSpanQuery,
  planTraceQuery,
  PREVIEW_MAX_LENGTH,
} from '@mastra/core/storage';
import type { CreateSpanRecord, ObservabilityStorage } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeSpan } from './data';

export interface PreviewTestsOptions {
  /**
   * Writes a completed span the way the store did before it stored previews: payload columns set,
   * preview columns NULL. Each store inserts the row directly, so readers must fall back to the
   * payload for it.
   */
  writeSpanWithoutPreviews: (span: CreateSpanRecord) => Promise<void>;
  /** Called after writes, for stores whose list tables fill asynchronously. */
  afterWrite?: () => Promise<void>;
  /** Whether the store implements `queryTraces()`. Defaults to true. */
  traceQuery?: boolean;
  /** Whether the store implements `querySpans()`. Defaults to true. */
  spanQuery?: boolean;
}

/**
 * Stored previews: every span stores `inputPreview` / `outputPreview` / `errorPreview` in the shared
 * `buildPreview` format, upstream previews win, and rows written before the columns existed still
 * list the same previews, built from their payloads.
 */
export function createPreviewTests(getStorage: () => ObservabilityStorage, options: PreviewTestsOptions) {
  describe('stored previews', () => {
    const start = new Date();
    start.setUTCHours(12, 0, 0, 0);
    const end = new Date(start.getTime() + 1000);
    const timeRange = { from: start.toISOString(), to: new Date(start.getTime() + 60_000).toISOString() };

    const input = {
      messages: [
        { role: 'system', content: 'be brief' },
        { role: 'user', content: 'first question' },
        { role: 'assistant', content: 'first answer' },
        { role: 'user', content: [{ type: 'text', text: 'second question' }] },
      ],
    };
    const output = { text: 'the final answer', usage: { inputTokens: 3 } };
    const error = { message: 'tool failed', id: 'TOOL_ERROR' };
    const longInput = 'q'.repeat(300);
    const expected = {
      root: { inputPreview: 'second question', outputPreview: 'the final answer', errorPreview: null },
      child: {
        inputPreview: `${'q'.repeat(PREVIEW_MAX_LENGTH)}…`,
        outputPreview: '{"rows":[1,2]}',
        errorPreview: 'tool failed',
      },
    };

    const root = (traceId: string, extra: Partial<CreateSpanRecord> = {}) =>
      makeSpan({ traceId, spanId: `${traceId}-root`, startedAt: start, endedAt: end, input, output, ...extra });
    const child = (traceId: string, extra: Partial<CreateSpanRecord> = {}) =>
      makeSpan({
        traceId,
        spanId: `${traceId}-child`,
        parentSpanId: `${traceId}-root`,
        spanType: SpanType.TOOL_CALL,
        startedAt: start,
        endedAt: end,
        input: longInput,
        output: { rows: [1, 2] },
        error,
        ...extra,
      });

    const previewsOf = (row: {
      inputPreview?: string | null;
      outputPreview?: string | null;
      errorPreview?: string | null;
    }) => ({
      inputPreview: row.inputPreview ?? null,
      outputPreview: row.outputPreview ?? null,
      errorPreview: row.errorPreview ?? null,
    });

    const listTraces = async () => {
      const result: Record<string, ReturnType<typeof previewsOf>> = {};
      for (const request of [{}, { pagination: { page: 0, perPage: 10 } }]) {
        const response = await getStorage().queryTraces(
          planTraceQuery(parseTraceQueryRequest({ timeRange, ...request })),
        );
        if (!('traces' in response)) throw new Error('Expected traces');
        const traces = Object.fromEntries(response.traces.map(trace => [trace.traceId, previewsOf(trace)]));
        if (Object.keys(result).length) expect(traces).toEqual(result);
        Object.assign(result, traces);
      }
      return result;
    };
    const listLight = async () => {
      const { spans } = await getStorage().listTracesLight({ pagination: { page: 0, perPage: 10 } });
      return Object.fromEntries(spans.map(span => [span.traceId, previewsOf(span)]));
    };
    const listSpans = async () => {
      const { spans } = await getStorage().querySpans(planSpanQuery({ timeRange }, {}));
      return Object.fromEntries(
        spans.map(span => [
          span.spanId,
          {
            ...previewsOf(span),
          },
        ]),
      );
    };

    beforeEach(async () => {
      await getStorage().dangerouslyClearAll();
    });

    it('stores previews on every span in the shared format', async () => {
      await getStorage().batchCreateSpans({ records: [root('trace-new'), child('trace-new')] });
      await options.afterWrite?.();

      if (options.traceQuery !== false) expect(await listTraces()).toEqual({ 'trace-new': expected.root });
      expect(await listLight()).toEqual({ 'trace-new': expected.root });
      if (options.spanQuery !== false) {
        expect(await listSpans()).toEqual({
          'trace-new-root': { ...expected.root },
          'trace-new-child': { ...expected.child },
        });
      }
    });

    it('trims upstream previews, caps them like generated ones and regenerates blank previews', async () => {
      // Oversized, and cut right before a surrogate pair: the cap must not split it.
      const oversized = `  ${'u'.repeat(99)}${'\u{1F600}'.repeat(100_000)}`;
      await getStorage().batchCreateSpans({
        records: [
          root('trace-upstream', { inputPreview: oversized, outputPreview: 'upstream output' }),
          child('trace-upstream', { errorPreview: '' }),
        ],
      });
      await options.afterWrite?.();

      const rootPreviews = {
        inputPreview: `${'u'.repeat(99)}…`,
        outputPreview: 'upstream output',
        errorPreview: null,
      };
      if (options.traceQuery !== false) expect(await listTraces()).toEqual({ 'trace-upstream': rootPreviews });
      expect(await listLight()).toEqual({ 'trace-upstream': rootPreviews });
      if (options.spanQuery !== false) {
        expect(await listSpans()).toEqual({
          'trace-upstream-root': { ...rootPreviews },
          'trace-upstream-child': { ...expected.child },
        });
      }
    });

    it('previews nothing for empty payloads', async () => {
      await getStorage().batchCreateSpans({
        records: [root('trace-empty', { input: undefined, output: '   ' }), child('trace-empty', { error: undefined })],
      });
      await options.afterWrite?.();

      const none = { inputPreview: null, outputPreview: null, errorPreview: null };
      if (options.traceQuery !== false) expect(await listTraces()).toEqual({ 'trace-empty': none });
      expect(await listLight()).toEqual({ 'trace-empty': none });
      if (options.spanQuery !== false) {
        expect((await listSpans())['trace-empty-child']).toEqual({
          ...expected.child,
          errorPreview: null,
        });
      }
    });

    it('builds previews from the payload for rows written before previews were stored', async () => {
      await options.writeSpanWithoutPreviews(root('trace-old', { error }));
      await options.writeSpanWithoutPreviews(child('trace-old'));
      await getStorage().batchCreateSpans({ records: [root('trace-new'), child('trace-new')] });
      await options.afterWrite?.();

      const oldRoot = { ...expected.root, errorPreview: 'tool failed' };
      expect(oldRoot.inputPreview).toBe(buildPreview(input));
      if (options.traceQuery !== false) {
        expect(await listTraces()).toEqual({ 'trace-old': oldRoot, 'trace-new': expected.root });
      }
      expect(await listLight()).toEqual({ 'trace-old': oldRoot, 'trace-new': expected.root });
      if (options.spanQuery !== false) {
        expect(await listSpans()).toEqual({
          'trace-old-root': { ...oldRoot },
          'trace-old-child': { ...expected.child },
          'trace-new-root': { ...expected.root },
          'trace-new-child': { ...expected.child },
        });
      }
    });
  });
}
