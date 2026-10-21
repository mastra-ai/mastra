import { SpanType } from '@mastra/core/observability';
import { planSpanQuery, PREVIEW_MAX_LENGTH, TraceQueryCursorError } from '@mastra/core/storage';
import type { ObservabilityStorage, SpanQueryRequest, SpanQueryRow } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeSpan } from './data';

/** The same list contract must hold for every storage implementation. */
export function createSpanQueryTests(
  getStorage: () => ObservabilityStorage,
  options: { completionOnly?: boolean; eventSourced?: boolean; immutableStartedAt?: boolean } = {},
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
      expect(getStorage().getFeatures()).toContain('span-query-context-fields');
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
        inputPreview: `${'x'.repeat(PREVIEW_MAX_LENGTH)}…`,
        outputPreview: null,
        errorPreview: null,
      });
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
      expect(result.spans[0]).toMatchObject({ ...scope, spanId: 'same', inputPreview: 'allowed' });
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

    // Some stores require all copies of an identity to have the same start time.
    it.skipIf(options.immutableStartedAt)('applies the time window to reconstructed current records', async () => {
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

    it('uses a half-open start window and the latest copy even when it ends after the window', async () => {
      const before = new Date(start.getTime() - 1);
      const after = new Date(Date.parse(timeRange.to) + 60_000);
      await getStorage().batchCreateSpans({
        records: [span('inside', { name: 'old' }), span('before', { startedAt: before })],
      });
      await getStorage().batchCreateSpans({
        records: [
          span('inside', { name: 'latest', endedAt: after }),
          span('before', { startedAt: before, endedAt: after }),
          span('at-end', { startedAt: new Date(timeRange.to), endedAt: after }),
        ],
      });
      const result = await query();
      expect(result.spans.map(row => row.spanId)).toEqual(['inside']);
      expect(result.spans[0]).toMatchObject({ name: 'latest', endedAt: after.toISOString() });
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
            { op: 'eq', left: { path: 'spanId' }, right: { literal: 'match' } },
          ],
        },
      });
      expect(result.spans.map(row => row.spanId)).toEqual(['match']);
      expect(result.spans[0]).toMatchObject({ model: 'test-model', provider: 'test-provider' });
    });

    describe('time to first chunk', () => {
      const ids = async (where: SpanQueryRequest['where']) =>
        (await query({ where })).spans.map(row => row.spanId).sort();

      describe('sort', () => {
        // Ties break by identity; empty values sort last in both directions.
        const expected = {
          asc: ['zero', 'fast', 'fraction', 'tie-a', 'tie-b', 'empty', 'missing'],
          desc: ['tie-a', 'tie-b', 'fraction', 'fast', 'zero', 'empty', 'missing'],
        };
        const orderBy = (direction: 'asc' | 'desc') => [{ field: 'timeToFirstChunkMs' as const, direction }];

        beforeEach(async () => {
          await getStorage().batchCreateSpans({
            records: [
              span('tie-b', { timeToFirstChunkMs: 300 }),
              span('empty', { timeToFirstChunkMs: null }),
              span('fraction', { timeToFirstChunkMs: 120.5 }),
              span('tie-a', { timeToFirstChunkMs: 300 }),
              span('zero', { timeToFirstChunkMs: 0 }),
              span('missing'),
              span('fast', { timeToFirstChunkMs: 50 }),
            ],
          });
        });

        it('advertises the sort', () => {
          expect(getStorage().getFeatures()).toContain('trace-query-time-to-first-chunk-sort');
        });

        it.each(['asc', 'desc'] as const)('pages %s with empty values last at every page size', async direction => {
          for (const limit of [1, 2, 3, 7]) {
            const rows: SpanQueryRow[] = [];
            let after: string | undefined;
            do {
              const page = await query({ orderBy: orderBy(direction), page: { limit, after } });
              rows.push(...page.spans);
              after = page.page.next ?? undefined;
              expect(rows.length).toBeLessThanOrEqual(expected[direction].length);
            } while (after);
            expect(
              rows.map(row => row.spanId),
              `limit ${limit}`,
            ).toEqual(expected[direction]);
          }
        });

        it('resumes after an empty value and rejects the cursor once the sort changes', async () => {
          const first = await query({ orderBy: orderBy('desc'), page: { limit: 6 } });
          expect(first.spans.at(-1)).toMatchObject({ spanId: 'empty', timeToFirstChunkMs: null });
          const after = first.page.next!;
          const rest = await query({ orderBy: orderBy('desc'), page: { limit: 6, after } });
          expect(rest.spans.map(row => row.spanId)).toEqual(['missing']);
          for (const changed of [orderBy('asc'), [{ field: 'startedAt' as const, direction: 'desc' as const }]]) {
            expect(() => query({ orderBy: changed, page: { limit: 6, after } })).toThrowError(TraceQueryCursorError);
          }
        });
      });

      it('returns the stored value, keeping zero and leaving missing values empty', async () => {
        await getStorage().batchCreateSpans({
          records: [
            span('present', { timeToFirstChunkMs: 250 }),
            span('zero', { timeToFirstChunkMs: 0 }),
            span('empty', { timeToFirstChunkMs: null }),
            span('missing'),
          ],
        });
        const values = Object.fromEntries((await query()).spans.map(row => [row.spanId, row.timeToFirstChunkMs]));
        expect(values).toEqual({ present: 250, zero: 0, empty: null, missing: null });
      });

      it('reads the value from the ended record when the span started before its first chunk', async () => {
        await getStorage().createSpan({ span: span('lifecycle', { endedAt: null }) });
        await getStorage().batchCreateSpans({ records: [span('lifecycle', { timeToFirstChunkMs: 400 })] });
        expect((await query()).spans.map(row => row.timeToFirstChunkMs)).toEqual([400]);
      });

      it('filters by the value, counting zero as a value and missing as empty', async () => {
        await getStorage().batchCreateSpans({
          records: [
            span('present', { timeToFirstChunkMs: 250 }),
            span('zero', { timeToFirstChunkMs: 0 }),
            span('missing'),
          ],
        });
        const field = { path: 'timeToFirstChunkMs' } as const;
        expect(await ids({ op: 'gt', left: field, right: { literal: 100 } })).toEqual(['present']);
        expect(await ids({ op: 'eq', left: field, right: { literal: 0 } })).toEqual(['zero']);
        expect(await ids({ op: 'exists', path: 'timeToFirstChunkMs' })).toEqual(['present', 'zero']);
        expect(await ids({ op: 'notExists', path: 'timeToFirstChunkMs' })).toEqual(['missing']);
      });
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

    it('filters and returns dedicated context and lineage fields', async () => {
      const context = {
        threadId: 'thread',
        requestId: 'request',
        serviceName: 'service',
        experimentId: 'experiment',
        environment: 'production',
        runId: 'run',
        sessionId: 'session',
        userId: 'user',
        entityVersionId: 'version',
        parentEntityVersionId: 'parent-version',
        rootEntityVersionId: 'root-version',
      };
      const lineage = {
        parentEntityType: 'agent',
        parentEntityId: 'parent',
        parentEntityName: 'Parent',
        rootEntityType: 'agent',
        rootEntityId: 'root',
        rootEntityName: 'Root',
      };
      await getStorage().batchCreateSpans({
        records: [span('context', { ...scope, ...context, ...lineage }), span('other')],
      });
      // OBS-712: advertised filter capabilities must match actual query behavior.
      const features = getStorage().getFeatures();
      expect(features).toContain('span-query-parent-entity-fields');
      expect(features).toContain('span-query-root-entity-fields');
      const expected = { ...context, ...lineage };
      for (const [field, value] of Object.entries(expected)) {
        const result = await query({ where: { op: 'eq', left: { path: field }, right: { literal: value } } });
        expect(result.spans.map(row => row.spanId)).toEqual(['context']);
        expect(result.spans[0]).toMatchObject(expected);
      }
    });

    it('filters trace and parent span identities independently', async () => {
      await getStorage().batchCreateSpans({
        records: [
          span('root', { traceId: 'trace-a' }),
          span('child', { traceId: 'trace-a', parentSpanId: 'root' }),
          span('other', { traceId: 'trace-b', parentSpanId: 'different-root' }),
        ],
      });
      const inTrace = await query({ where: { op: 'eq', left: { path: 'traceId' }, right: { literal: 'trace-a' } } });
      expect(inTrace.spans.map(row => row.spanId).sort()).toEqual(['child', 'root']);
      const children = await query({ where: { op: 'eq', left: { path: 'parentSpanId' }, right: { literal: 'root' } } });
      expect(children.spans.map(row => row.spanId)).toEqual(['child']);
      expect((await query({ where: { op: 'notExists', path: 'parentSpanId' } })).spans.map(row => row.spanId)).toEqual([
        'root',
      ]);
    });

    it('maps span source to executionSource', async () => {
      expect(getStorage().getFeatures()).toContain('span-query-execution-source');
      await getStorage().batchCreateSpans({
        records: [span('agent', { source: 'agent' }), span('workflow', { source: 'workflow' }), span('absent')],
      });
      const result = await query({
        where: { op: 'eq', left: { path: 'executionSource' }, right: { literal: 'agent' } },
      });
      expect(result.spans.map(row => row.spanId)).toEqual(['agent']);
      expect(result.spans[0]).toMatchObject({ executionSource: 'agent' });
      const absent = await query({ where: { op: 'notExists', path: 'executionSource' } });
      expect(absent.spans.map(row => row.spanId)).toEqual(['absent']);
      for (const row of absent.spans) expect(row.executionSource).toBeNull();
    });

    it('keeps name matching limited to whole normalized words and phrases', async () => {
      await getStorage().batchCreateSpans({
        records: [span('match', { name: 'Agent: Model Response' }), span('other', { name: 'Model Responses' })],
      });
      for (const [op, expected] of [
        ['matches', 'match'],
        ['notMatches', 'other'],
      ] as const) {
        const result = await query({ where: { op, left: { path: 'name' }, right: { literal: 'MODEL response' } } });
        expect(result.spans.map(row => row.spanId)).toEqual([expected]);
      }
    });

    it('does not return cost or legacy truncation flags', async () => {
      await getStorage().batchCreateSpans({ records: [span('summary')] });
      const row = (await query()).spans[0]!;
      for (const field of ['cost', 'inputTruncated', 'outputTruncated', 'errorTruncated'])
        expect(row).not.toHaveProperty(field);
    });
  });
}
