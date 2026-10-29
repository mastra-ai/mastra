import { SpanType } from '@mastra/core/observability';
import {
  parseGetTraceQueryValuesArgs,
  parseTraceAggregateRequest,
  parseTraceQueryRequest,
  planSpanAggregate,
  planSpanQuery,
  planTraceAggregate,
  planTraceQuery,
  planTraceQueryValues,
} from '@mastra/core/storage';
import type { ObservabilityStorage, SpanQueryRequest, TraceQueryRequest } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { VNEXT_BASE_DATE, makeSpan } from './data';

const SPAN_FEATURE = 'span-query-outcome-fields';
const TRACE_FEATURE = 'trace-query-outcome-fields';

const at = (ms: number) => new Date(VNEXT_BASE_DATE.getTime() + ms);
const timeRange = { from: at(-60_000).toISOString(), to: at(60_000).toISOString() };

/**
 * Fixture: four traces whose root and child outcomes differ, so trace-scope predicates (root
 * values) and `spans.some` / `spans.none` (any span) give different answers.
 *
 * | trace       | span          | outcome           | stopReason    | stopReasonContext |
 * |-------------|---------------|-------------------|---------------|-------------------|
 * | out-success | root          | success           | –             | –                 |
 * | out-success | child (tool)  | limit             | max_steps     | { maxSteps: 5 }   |
 * | out-unknown | root          | unknown           | –             | –                 |
 * | out-custom  | root          | my-custom-outcome | custom:reason | –                 |
 * | out-missing | root          | not recorded      | not recorded  | not recorded      |
 *
 * `out-missing` stands for a span written by an SDK that predates the fields: it must stay
 * "not recorded" and never read as success. Its `status` is still derived from `error`.
 */
async function writeOutcomeFixture(storage: ObservabilityStorage) {
  await storage.batchCreateSpans({
    records: [
      makeSpan({ traceId: 'out-success', spanId: 'success-root', outcome: 'success' }),
      makeSpan({
        traceId: 'out-success',
        spanId: 'success-child',
        parentSpanId: 'success-root',
        spanType: SpanType.TOOL_CALL,
        startedAt: at(100),
        outcome: 'limit',
        stopReason: 'max_steps',
        stopReasonContext: { maxSteps: 5 },
      }),
      makeSpan({ traceId: 'out-unknown', spanId: 'unknown-root', startedAt: at(200), outcome: 'unknown' }),
      makeSpan({
        traceId: 'out-custom',
        spanId: 'custom-root',
        startedAt: at(300),
        outcome: 'my-custom-outcome',
        stopReason: 'custom:reason',
      }),
      makeSpan({ traceId: 'out-missing', spanId: 'missing-root', startedAt: at(400) }),
    ],
  });
}

/**
 * Conformance for `outcome`, `stopReason` and `stopReasonContext` across span queries, span
 * aggregates, trace queries, trace aggregates and value discovery. Each test is skipped on stores
 * that do not declare the matching feature.
 */
export function createOutcomeFieldTests(options: {
  getStorage: () => ObservabilityStorage;
  flushPendingMerges?: (storage: ObservabilityStorage) => Promise<void> | void;
  refreshDiscovery?: (storage: ObservabilityStorage) => Promise<void> | void;
}) {
  const { getStorage, flushPendingMerges, refreshDiscovery } = options;
  const outcomePath = { path: 'outcome' };

  describe('outcome fields', () => {
    beforeEach(async () => {
      const storage = getStorage();
      if (!storage.getFeatures()?.some(feature => feature === SPAN_FEATURE || feature === TRACE_FEATURE)) return;
      await writeOutcomeFixture(storage);
      if (flushPendingMerges) await flushPendingMerges(storage);
    });

    describe('querySpans', () => {
      const spans = async (where: SpanQueryRequest['where']) => {
        const response = await getStorage().querySpans(planSpanQuery({ timeRange, where }));
        return response.spans.map(span => span.spanId).sort();
      };

      it('filters on recorded, unknown and custom outcomes', async ({ skip }) => {
        if (!getStorage().getFeatures()?.includes(SPAN_FEATURE)) skip();
        expect(await spans({ op: 'eq', left: outcomePath, right: { literal: 'limit' } })).toEqual(['success-child']);
        expect(await spans({ op: 'eq', left: outcomePath, right: { literal: 'unknown' } })).toEqual(['unknown-root']);
        expect(await spans({ op: 'in', value: outcomePath, set: ['my-custom-outcome', 'success'] })).toEqual([
          'custom-root',
          'success-root',
        ]);
        expect(await spans({ op: 'eq', left: { path: 'stopReason' }, right: { literal: 'custom:reason' } })).toEqual([
          'custom-root',
        ]);
      });

      it('treats a missing outcome as not recorded, never as success', async ({ skip }) => {
        if (!getStorage().getFeatures()?.includes(SPAN_FEATURE)) skip();
        expect(await spans({ op: 'notExists', path: 'outcome' })).toEqual(['missing-root']);
        expect(await spans({ op: 'eq', left: outcomePath, right: { literal: 'success' } })).toEqual(['success-root']);
        expect(await spans({ op: 'notExists', path: 'stopReason' })).toEqual([
          'missing-root',
          'success-root',
          'unknown-root',
        ]);
      });

      it('keeps the null semantics of other nullable string fields for ne and notIn', async ({ skip }) => {
        if (!getStorage().getFeatures()?.includes(SPAN_FEATURE)) skip();
        // Like every other nullable string field, `ne` / `notIn` match a missing value.
        expect(await spans({ op: 'ne', left: outcomePath, right: { literal: 'success' } })).toEqual([
          'custom-root',
          'missing-root',
          'success-child',
          'unknown-root',
        ]);
        expect(await spans({ op: 'notIn', value: outcomePath, set: ['success', 'limit', 'unknown'] })).toEqual([
          'custom-root',
          'missing-root',
        ]);
        // Same rule on an existing nullable string field, so the two cannot drift apart.
        expect(await spans({ op: 'ne', left: { path: 'environment' }, right: { literal: 'production' } })).toHaveLength(
          5,
        );
      });

      it('returns outcome, stop reason and stop reason context on rows', async ({ skip }) => {
        if (!getStorage().getFeatures()?.includes(SPAN_FEATURE)) skip();
        const response = await getStorage().querySpans(planSpanQuery({ timeRange }));
        const bySpan = Object.fromEntries(response.spans.map(span => [span.spanId, span]));
        expect(bySpan['success-child']).toMatchObject({
          outcome: 'limit',
          stopReason: 'max_steps',
          stopReasonContext: { maxSteps: 5 },
          status: 'success',
        });
        expect(bySpan['custom-root']).toMatchObject({
          outcome: 'my-custom-outcome',
          stopReason: 'custom:reason',
          stopReasonContext: null,
        });
        expect(bySpan['missing-root']).toMatchObject({
          outcome: null,
          stopReason: null,
          stopReasonContext: null,
          status: 'success',
        });
      });

      it('never accepts stop reason context as a predicate', ({ skip }) => {
        if (!getStorage().getFeatures()?.includes(SPAN_FEATURE)) skip();
        expect(() => planSpanQuery({ timeRange, where: { op: 'exists', path: 'stopReasonContext' } })).toThrow();
      });
    });

    describe('aggregateSpans', () => {
      it('groups by outcome and stop reason, with a bucket for not recorded', async ({ skip }) => {
        if (!getStorage().getFeatures()?.includes(SPAN_FEATURE)) skip();
        const response = await getStorage().aggregateSpans(
          planSpanAggregate({ timeRange, groupBy: ['outcome', 'stopReason'], measures: ['count'] }),
        );
        const groups = response.rows
          .map(row => [row.dimensions?.outcome ?? null, row.dimensions?.stopReason ?? null, row.measures.count])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
        expect(groups).toEqual([
          ['limit', 'max_steps', 1],
          ['my-custom-outcome', 'custom:reason', 1],
          [null, null, 1],
          ['success', null, 1],
          ['unknown', null, 1],
        ]);
      });

      it('counts distinct outcomes, ignoring not recorded', async ({ skip }) => {
        if (!getStorage().getFeatures()?.includes(SPAN_FEATURE)) skip();
        const response = await getStorage().aggregateSpans(
          planSpanAggregate({ timeRange, measures: ['count', 'countDistinct.outcome'] }),
        );
        expect(response.rows).toHaveLength(1);
        expect(response.rows[0]!.measures).toMatchObject({ count: 5, 'countDistinct.outcome': 4 });
      });
    });

    describe('queryTraces', () => {
      const traces = async (where?: TraceQueryRequest['where']) => {
        const response = await getStorage().queryTraces(planTraceQuery(parseTraceQueryRequest({ timeRange, where })));
        if (!('traces' in response)) throw new Error('Expected traces');
        return response.traces;
      };
      const traceIds = async (where?: TraceQueryRequest['where']) =>
        (await traces(where)).map(trace => trace.traceId).sort();

      it("filters the trace scope on the root span's outcome only", async ({ skip }) => {
        if (!getStorage().getFeatures()?.includes(TRACE_FEATURE)) skip();
        // The child's `limit` does not make the trace a `limit` trace.
        expect(await traceIds({ op: 'eq', left: outcomePath, right: { literal: 'limit' } })).toEqual([]);
        expect(await traceIds({ op: 'eq', left: outcomePath, right: { literal: 'success' } })).toEqual(['out-success']);
        expect(await traceIds({ op: 'in', value: outcomePath, set: ['unknown', 'my-custom-outcome'] })).toEqual([
          'out-custom',
          'out-unknown',
        ]);
        expect(await traceIds({ op: 'eq', left: { path: 'stopReason' }, right: { literal: 'custom:reason' } })).toEqual(
          ['out-custom'],
        );
        expect(await traceIds({ op: 'notExists', path: 'outcome' })).toEqual(['out-missing']);
        expect(await traceIds({ op: 'ne', left: outcomePath, right: { literal: 'success' } })).toEqual([
          'out-custom',
          'out-missing',
          'out-unknown',
        ]);
      });

      it("filters on any span's outcome through spans.some and spans.none", async ({ skip }) => {
        if (!getStorage().getFeatures()?.includes(TRACE_FEATURE)) skip();
        const limit = { op: 'eq', left: outcomePath, right: { literal: 'limit' } } as const;
        expect(await traceIds({ spans: { some: limit } })).toEqual(['out-success']);
        expect(await traceIds({ spans: { none: limit } })).toEqual(['out-custom', 'out-missing', 'out-unknown']);
        expect(
          await traceIds({
            spans: { some: { op: 'eq', left: { path: 'stopReason' }, right: { literal: 'max_steps' } } },
          }),
        ).toEqual(['out-success']);
      });

      it("returns the root span's outcome fields and leaves status unchanged", async ({ skip }) => {
        if (!getStorage().getFeatures()?.includes(TRACE_FEATURE)) skip();
        const byTrace = Object.fromEntries((await traces()).map(trace => [trace.traceId, trace]));
        expect(byTrace['out-success']).toMatchObject({
          outcome: 'success',
          stopReason: null,
          stopReasonContext: null,
          status: 'success',
        });
        expect(byTrace['out-custom']).toMatchObject({ outcome: 'my-custom-outcome', stopReason: 'custom:reason' });
        expect(byTrace['out-unknown']).toMatchObject({ outcome: 'unknown', status: 'success' });
        expect(byTrace['out-missing']).toMatchObject({
          outcome: null,
          stopReason: null,
          stopReasonContext: null,
          status: 'success',
        });
      });
    });

    describe('aggregateTraces', () => {
      it("groups traces by the root span's outcome", async ({ skip }) => {
        if (!getStorage().getFeatures()?.includes(TRACE_FEATURE)) skip();
        const response = await getStorage().aggregateTraces(
          planTraceAggregate(parseTraceAggregateRequest({ timeRange, groupBy: ['outcome'], measures: ['count'] })),
        );
        const groups = Object.fromEntries(
          response.rows.map(row => [String(row.dimensions?.outcome ?? null), row.measures.count]),
        );
        expect(groups).toEqual({ success: 1, unknown: 1, 'my-custom-outcome': 1, null: 1 });
      });
    });

    describe('value discovery', () => {
      const values = async (predicateScope: 'trace' | 'spans', path: string) => {
        const response = await getStorage().getTraceQueryValues(
          planTraceQueryValues(parseGetTraceQueryValuesArgs({ timeRange, predicateScope, path })),
        );
        return response.values.map(value => value.value).sort();
      };

      it('suggests root outcome values for traces and every span outcome for spans', async ({ skip }) => {
        if (!getStorage().getFeatures()?.includes(TRACE_FEATURE)) skip();
        if (refreshDiscovery) await refreshDiscovery(getStorage());
        expect(await values('trace', 'outcome')).toEqual(['my-custom-outcome', 'success', 'unknown']);
        expect(await values('spans', 'outcome')).toEqual(['limit', 'my-custom-outcome', 'success', 'unknown']);
        expect(await values('trace', 'stopReason')).toEqual(['custom:reason']);
        expect(await values('spans', 'stopReason')).toEqual(['custom:reason', 'max_steps']);
      });
    });
  });
}
