import { SpanType } from '@mastra/core/observability';
import { planSpanQuery } from '@mastra/core/storage';
import type { ObservabilityStorage, SpanQueryRequest, SpanQueryRow } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeSpan } from './data';

/** The same list contract must hold for every storage implementation. */
export function createSpanQueryTests(
  getStorage: () => ObservabilityStorage,
  options: { completionOnly?: boolean; eventSourced?: boolean } = {},
) {
  describe('querySpans conformance', () => {
    const start = new Date();
    start.setUTCHours(12, 0, 0, 0);
    const end = new Date(start.getTime() + 1000);
    const timeRange = { from: start.toISOString(), to: new Date(start.getTime() + 60_000).toISOString() };
    const scope = { organizationId: 'org-a', resourceId: 'resource-a' };
    const span = (spanId: string, extra = {}) =>
      makeSpan({
        traceId: `trace-${spanId}`,
        spanId,
        startedAt: start,
        endedAt: end,
        ...extra,
      });
    const query = (request: Partial<SpanQueryRequest> = {}, tenant?: typeof scope) =>
      getStorage().querySpans(planSpanQuery({ timeRange, ...request }, { scope: tenant }));

    beforeEach(async () => {
      await getStorage().dangerouslyClearAll();
    });

    it('advertises support and returns an empty page', async () => {
      expect(getStorage().getFeatures()).toContain('span-query');
      expect(await query()).toEqual({ spans: [], page: { next: null } });
    });

    it('returns matching child spans, bounded previews, and identifiers for existing detail reads', async () => {
      const input = 'x'.repeat(300);
      await getStorage().batchCreateSpans({
        records: [
          span('root'),
          span('tool', { traceId: 'trace-root', parentSpanId: 'root', spanType: SpanType.TOOL_CALL, input }),
        ],
      });
      const result = await query({ where: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'tool_call' } } });
      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]).toMatchObject({
        spanId: 'tool',
        traceId: 'trace-root',
        parentSpanId: 'root',
        durationMs: 1000,
        status: 'success',
        inputTruncated: true,
        outputTruncated: false,
        cost: { state: 'missing' },
      });
      expect([...result.spans[0]!.inputPreview!]).toHaveLength(256);
      expect((await getStorage().getSpan({ traceId: 'trace-root', spanId: 'tool' }))?.span.input).toBe(input);
    });

    it.each(['startedAt', 'endedAt'] as const)('paginates timestamp ties by full identity for %s', async field => {
      const records = [
        span('z'),
        span('a'),
        span('é'),
        span('A'),
        span('tenant', scope),
        span('resource-null', { organizationId: 'org-a' }),
        span('earlier', { startedAt: new Date(start.getTime() + 2000), endedAt: new Date(end.getTime() + 2000) }),
      ];
      await getStorage().batchCreateSpans({ records });
      for (const direction of ['asc', 'desc'] as const) {
        const rows: SpanQueryRow[] = [];
        let after: string | undefined;
        do {
          const page = await query({ orderBy: [{ field, direction }], page: { limit: 2, after } });
          rows.push(...page.spans);
          after = page.page.next ?? undefined;
          expect(rows.length).toBeLessThanOrEqual(records.length);
        } while (after);
        const tied = ['tenant', 'resource-null', 'A', 'a', 'z', 'é'];
        expect(rows.map(row => row.spanId)).toEqual(direction === 'asc' ? [...tied, 'earlier'] : ['earlier', ...tied]);
      }
    });

    it('hydrates the maximum supported page without losing its continuation', async () => {
      await getStorage().batchCreateSpans({
        records: Array.from({ length: 1001 }, (_, index) => span(`s${String(index).padStart(4, '0')}`, scope)),
      });
      const first = await query({ page: { limit: 1000 } }, scope);
      expect(first.spans).toHaveLength(1000);
      expect(first.page.next).not.toBeNull();
      const second = await query({ page: { limit: 1000, after: first.page.next! } }, scope);
      expect(second.spans.map(row => row.spanId)).toEqual(['s1000']);
      expect(second.page.next).toBeNull();
    });

    it('applies trusted tenant scope to selection and payload hydration', async () => {
      await getStorage().batchCreateSpans({
        records: [
          span('same', { ...scope, input: 'allowed' }),
          span('same', { ...scope, organizationId: 'org-b', endedAt: new Date(end.getTime() + 1), input: 'other org' }),
          span('same', {
            ...scope,
            resourceId: 'resource-b',
            endedAt: new Date(end.getTime() + 2),
            input: 'other resource',
          }),
          span('local'),
        ],
      });
      const result = await query({}, scope);
      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]).toMatchObject({ ...scope, spanId: 'same', inputPreview: '"allowed"' });
      const contradiction = await query(
        {
          where: { op: 'eq', left: { path: 'organizationId' }, right: { literal: 'org-b' } },
        },
        scope,
      );
      expect(contradiction.spans).toEqual([]);
    });

    it('selects the current completed record before evaluating mutable predicates', async () => {
      await getStorage().batchCreateSpans({ records: [span('changed', { name: 'old' })] });
      await getStorage().batchCreateSpans({
        records: [
          span('changed', { name: 'new', endedAt: new Date(end.getTime() + 1) }),
          ...(options.completionOnly ? [] : [span('pending', { endedAt: null })]),
          span('outside', { startedAt: new Date(timeRange.to), endedAt: new Date(Date.parse(timeRange.to) + 1000) }),
        ],
      });
      expect((await query({ where: { op: 'eq', left: { path: 'name' }, right: { literal: 'old' } } })).spans).toEqual(
        [],
      );
      expect((await query()).spans.map(row => row.name)).toEqual(['new']);
    });

    it('applies the time window to reconstructed current records', async () => {
      const earlier = new Date(start.getTime() - 60_000);
      const later = new Date(Date.parse(timeRange.to) + 60_000);
      await getStorage().batchCreateSpans({ records: [span('moved-in', { startedAt: earlier }), span('moved-out')] });
      await getStorage().batchCreateSpans({
        records: [
          span('moved-in', { endedAt: new Date(end.getTime() + 1) }),
          span('moved-out', { startedAt: later, endedAt: new Date(later.getTime() + 1000) }),
        ],
      });
      // Event-sourced stores retain the earliest start event. Record stores use the current completed row.
      expect((await query()).spans.map(row => row.spanId)).toEqual(options.eventSourced ? ['moved-out'] : ['moved-in']);
    });

    it('reuses boolean, numeric, and literal filter semantics', async () => {
      const name = "find'; DROP TABLE span_events; --";
      await getStorage().batchCreateSpans({
        records: [
          span('match', { name, attributes: { model: 'test-model', provider: 'test-provider' } }),
          span('other'),
        ],
      });
      const result = await query({
        where: {
          op: 'and',
          args: [
            { op: 'eq', left: { path: 'name' }, right: { literal: name } },
            { op: 'gte', left: { path: 'durationMs' }, right: { literal: 1000 } },
            { op: 'eq', left: { path: 'model' }, right: { literal: 'test-model' } },
          ],
        },
      });
      expect(result.spans.map(row => row.spanId)).toEqual(['match']);
    });

    it('preserves error presence through current-record selection and boolean filters', async () => {
      await getStorage().batchCreateSpans({ records: [span('failed', { error: { message: 'failure' } }), span('ok')] });
      const result = await query({
        where: {
          op: 'and',
          args: [
            { op: 'exists', path: 'error' },
            { op: 'not', arg: { op: 'eq', left: { path: 'status' }, right: { literal: 'success' } } },
          ],
        },
      });
      expect(result.spans.map(row => [row.spanId, row.status])).toEqual([['failed', 'error']]);
    });

    it('includes cost metrics after the span search window', async () => {
      const completedAt = new Date(Date.parse(timeRange.to) + 24 * 60 * 60 * 1000);
      await getStorage().batchCreateSpans({ records: [span('late-cost', { ...scope, endedAt: completedAt })] });
      await getStorage().batchCreateMetrics({
        metrics: [
          {
            ...scope,
            metricId: 'late-cost',
            traceId: 'trace-late-cost',
            spanId: 'late-cost',
            timestamp: completedAt,
            name: 'mastra_model_total_input_tokens',
            value: 10,
            labels: {},
            estimatedCost: 0.01,
            costUnit: 'usd',
            costMetadata: { allocation: 'query_total' },
          },
        ],
      });
      const result = await query({}, scope);
      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]).toMatchObject({
        spanId: 'late-cost',
        cost: { state: 'available', amount: 0.01, currency: 'usd' },
      });
    });

    it('deduplicates retried metrics and does not double-count token details', async () => {
      await getStorage().batchCreateSpans({ records: [span('priced', scope), span('free'), span('unpriced')] });
      const metrics = [
        { metricId: 'input', spanId: 'priced', estimatedCost: 0.01, name: 'mastra_model_total_input_tokens', ...scope },
        {
          metricId: 'output',
          spanId: 'priced',
          estimatedCost: 0.02,
          name: 'mastra_model_total_output_tokens',
          ...scope,
        },
        { metricId: 'detail', spanId: 'priced', estimatedCost: 0.01, name: 'mastra_model_input_text_tokens', ...scope },
        {
          metricId: 'free',
          spanId: 'free',
          estimatedCost: 0,
          name: 'mastra_model_total_input_tokens',
          costMetadata: { allocation: 'query_total' },
        },
        { metricId: 'unpriced', spanId: 'unpriced', estimatedCost: null, name: 'mastra_model_total_input_tokens' },
      ].map(metric => ({
        ...metric,
        traceId: `trace-${metric.spanId}`,
        timestamp: start,
        value: 10,
        labels: {},
        costUnit: 'usd',
      }));
      await getStorage().batchCreateMetrics({ metrics });
      await getStorage().batchCreateMetrics({ metrics });
      await getStorage().batchCreateMetrics({
        metrics: [{ ...metrics[0]!, metricId: 'other-tenant', organizationId: 'org-b', estimatedCost: 999 }],
      });
      const costs = Object.fromEntries((await query()).spans.map(row => [row.spanId, row.cost]));
      expect(costs).toEqual({
        priced: { state: 'available', amount: 0.03, currency: 'usd' },
        free: { state: 'available', amount: 0, currency: 'usd' },
        unpriced: { state: 'unavailable' },
      });
    });
  });
}
