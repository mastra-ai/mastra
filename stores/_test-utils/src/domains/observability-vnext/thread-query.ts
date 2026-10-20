import { SpanType } from '@mastra/core/observability';
import { planThreadRowsQuery, threadQueryResponseSchema } from '@mastra/core/storage';
import type { CreateSpanRecord, ObservabilityStorage, ThreadQueryRequest, ThreadQueryRow } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeSpan } from './data';

/** Public storage conformance shared by ClickHouse, PostgreSQL and DuckDB. */
export function createThreadQueryTests(
  getStorage: () => ObservabilityStorage,
  options: {
    writeSpanWithoutPreviews: (span: CreateSpanRecord) => Promise<void>;
  },
) {
  describe('queryThreads row conformance', () => {
    const base = new Date();
    base.setUTCHours(12, 0, 0, 0);
    const at = (seconds: number) => new Date(base.getTime() + seconds * 1000);
    const range = { from: at(10).toISOString(), to: at(20).toISOString() };
    const scope = { organizationId: 'org-a', resourceId: 'resource-a' };
    const root = (traceId: string, seconds: number, extra: Partial<CreateSpanRecord> = {}) =>
      makeSpan({
        ...scope,
        traceId,
        spanId: `root-${traceId}`,
        parentSpanId: null,
        spanType: SpanType.AGENT_RUN,
        threadId: 'thread-a',
        startedAt: at(seconds),
        endedAt: at(seconds + 1),
        ...extra,
      });
    const query = async (request: Partial<ThreadQueryRequest> = {}, tenant?: typeof scope) =>
      threadQueryResponseSchema.parse(
        await getStorage().queryThreads(
          planThreadRowsQuery({ timeRange: { traces: range }, ...request }, { scope: tenant }),
        ),
      );
    beforeEach(async () => {
      await getStorage().dangerouslyClearAll();
    });

    it('qualifies by an interior trace but returns full history and first/last representatives', async () => {
      // The server checks the public store, including any compatibility wrapper.
      expect(getStorage().getFeatures()).toContain('thread-query-rows');
      await getStorage().batchCreateSpans({
        records: [
          root('a', 0, { userId: null, input: 'first input', output: 'old output', endedAt: at(40) }),
          root('b', 15, { userId: 'middle-user', error: { message: 'old error' } }),
          root('c', 30, { userId: 'last-user', output: 'last output' }),
        ],
      });
      const result = await query();
      expect(result.threads).toHaveLength(1);
      expect(result.threads[0]).toMatchObject({
        threadId: 'thread-a',
        firstTraceId: 'a',
        lastTraceId: 'c',
        userId: null,
        traceCount: 3,
        startedAt: at(0).toISOString(),
        endedAt: at(40).toISOString(),
        inputPreview: 'first input',
        outputPreview: 'last output',
        errorPreview: null,
        status: 'success',
      });
      expect(
        (await query({ where: { op: 'eq', left: { path: 'userId' }, right: { literal: 'middle-user' } } })).threads,
      ).toEqual([]);
      expect(
        (await query({ where: { op: 'eq', left: { path: 'status' }, right: { literal: 'error' } } })).threads,
      ).toEqual([]);
      expect(
        (await query({ where: { op: 'gte', left: { path: 'traceCount' }, right: { literal: 3 } } })).threads,
      ).toHaveLength(1);
    });

    it('distinguishes trace starts, thread starts and maximum thread end time', async () => {
      await getStorage().batchCreateSpans({ records: [root('a', 0, { endedAt: at(19) }), root('b', 5)] });
      expect((await query()).threads).toEqual([]); // Overlap alone does not qualify.
      expect((await query({ timeRange: { threads: { ...range, field: 'startedAt' } } })).threads).toEqual([]);
      expect((await query({ timeRange: { threads: { ...range, field: 'endedAt' } } })).threads[0]).toMatchObject({
        firstTraceId: 'a',
        lastTraceId: 'b',
        endedAt: at(19).toISOString(),
        traceCount: 2,
      });
    });

    it('preserves tenant/resource scope during history expansion and separates organizations', async () => {
      await getStorage().batchCreateSpans({
        records: [
          root('a', 15),
          root('outside-resource', 0, { resourceId: 'resource-b' }),
          root('outside-org', 30, { organizationId: 'org-b' }),
        ],
      });
      expect((await query({}, scope)).threads[0]).toMatchObject({ firstTraceId: 'a', traceCount: 1 });
      const all = await query({ timeRange: { traces: { from: at(-1).toISOString(), to: at(60).toISOString() } } });
      expect(all.threads).toHaveLength(2);
      expect(all.threads.find(row => row.organizationId === 'org-a')).toMatchObject({
        firstTraceId: 'outside-resource',
        traceCount: 2,
      });
    });

    it.each(['startedAt', 'endedAt'] as const)(
      'paginates tied %s values without gaps in either direction',
      async field => {
        await getStorage().batchCreateSpans({
          records: ['z', 'a', 'é', 'A'].map(threadId => root(threadId, 15, { threadId })),
        });
        for (const direction of ['asc', 'desc'] as const) {
          const rows: ThreadQueryRow[] = [];
          let after: string | undefined;
          do {
            const result = await query({ orderBy: [{ field, direction }], page: { limit: 2, after } });
            rows.push(...result.threads);
            after = result.page.next ?? undefined;
            expect(rows.length).toBeLessThanOrEqual(4);
          } while (after);
          expect(rows.map(row => row.threadId)).toEqual(['A', 'a', 'z', 'é']);
        }
      },
    );

    it('breaks first/last trace timestamp ties deterministically and ignores child spans', async () => {
      await getStorage().batchCreateSpans({
        records: [
          root('z', 15),
          root('a', 15),
          root('a', 16, { spanId: 'child', parentSpanId: 'root-a', input: 'not the first root' }),
        ],
      });
      expect((await query()).threads[0]).toMatchObject({ firstTraceId: 'a', lastTraceId: 'z', traceCount: 2 });
    });

    it('counts a logical trace once even when the stored data contains multiple roots', async () => {
      await getStorage().batchCreateSpans({
        records: [root('a', 15), root('a', 15, { spanId: 'other-root' }), root('b', 16)],
      });
      expect((await query()).threads[0]).toMatchObject({ firstTraceId: 'a', lastTraceId: 'b', traceCount: 2 });
    });

    it('uses the earliest root consistently when malformed roots disagree on thread and start time', async () => {
      await getStorage().batchCreateSpans({
        records: [
          root('a', 5, { spanId: 'root-one', threadId: 'thread-one', input: 'one' }),
          root('a', 15, { spanId: 'root-two', threadId: 'thread-two', input: 'two' }),
        ],
      });
      const allRange = { from: at(0).toISOString(), to: at(40).toISOString() };
      const threads = await query({ timeRange: { traces: allRange } });
      expect(threads.threads).toHaveLength(1);
      expect(threads.threads[0]).toMatchObject({ threadId: 'thread-one', inputPreview: 'one', traceCount: 1 });
      const otherStart = 15;
      expect(
        (
          await query({
            timeRange: { traces: { from: at(otherStart).toISOString(), to: at(otherStart + 1).toISOString() } },
          })
        ).threads,
      ).toEqual([]);
    });

    it('finds a completed thread when its thread ID was absent at span start', async () => {
      await getStorage().batchCreateSpans({ records: [root('late-context', 15, { endedAt: null, threadId: null })] });
      await getStorage().batchCreateSpans({ records: [root('late-context', 15, { threadId: 'arrived-later' })] });
      expect((await query()).threads).toHaveLength(1);
      expect((await query()).threads[0]).toMatchObject({ threadId: 'arrived-later', traceCount: 1 });
    });

    it('counts retried copies of completed spans only once', async () => {
      const span = root('retry', 15, { output: 'completed' });
      await getStorage().batchCreateSpans({ records: [span] });
      await getStorage().batchCreateSpans({ records: [span] });
      expect((await query()).threads[0]).toMatchObject({ traceCount: 1, outputPreview: 'completed' });
    });

    it('does not promote a later root into a candidate thread when the earliest root has no thread', async () => {
      await getStorage().batchCreateSpans({
        records: [
          root('malformed', 1, { spanId: 'original', threadId: null }),
          root('malformed', 15, { spanId: 'extra', threadId: 'target', input: 'wrong root' }),
          root('valid', 16, { threadId: 'target', input: 'valid root' }),
        ],
      });
      expect((await query()).threads).toHaveLength(1);
      expect((await query()).threads[0]).toMatchObject({
        threadId: 'target',
        traceCount: 1,
        firstTraceId: 'valid',
        inputPreview: 'valid root',
      });
    });

    it('keeps null and named organization identities separate during candidate expansion', async () => {
      await getStorage().batchCreateSpans({
        records: [
          root('same', 15, { organizationId: null, resourceId: null, threadId: 'same', input: 'null tenant' }),
          root('same', 15.1, {
            organizationId: null,
            resourceId: null,
            spanId: 'null-tenant-model',
            parentSpanId: 'root-same',
            spanType: SpanType.MODEL_GENERATION,
            attributes: { model: 'gpt-4o', provider: 'openai' },
          }),
          root('same', 16, { organizationId: 'org-a', threadId: 'same', input: 'named tenant' }),
        ],
      });
      const rows = (await query()).threads;
      expect(rows).toHaveLength(2);
      expect(rows.find(row => row.organizationId === null)).toMatchObject({
        traceCount: 1,
        inputPreview: 'null tenant',
        resourceId: null,
        model: 'gpt-4o',
        provider: 'openai',
      });
      expect(rows.find(row => row.organizationId === 'org-a')).toMatchObject({
        traceCount: 1,
        inputPreview: 'named tenant',
      });
    });

    it('filters first-trace typed values and does not borrow TTFC from a later trace', async () => {
      await getStorage().batchCreateSpans({
        records: [
          root('a', 15, { source: 'api', requestId: 'request-first', timeToFirstChunkMs: 125 }),
          root('b', 16, { source: 'studio', requestId: 'request-last', timeToFirstChunkMs: 900 }),
        ],
      });
      const result = await query({
        where: {
          op: 'and',
          args: [
            { op: 'eq', left: { path: 'executionSource' }, right: { literal: 'api' } },
            { op: 'eq', left: { path: 'requestId' }, right: { literal: 'request-first' } },
            { op: 'lt', left: { path: 'timeToFirstChunkMs' }, right: { literal: 200 } },
            { op: 'gte', left: { path: 'startedAt' }, right: { literal: at(15).toISOString() } },
          ],
        },
      });
      expect(result.threads[0]).toMatchObject({
        executionSource: 'api',
        requestId: 'request-first',
        timeToFirstChunkMs: 125,
      });
    });

    it('returns null root-agent fields for a non-agent first trace', async () => {
      await getStorage().batchCreateSpans({
        records: [
          root('a', 15, { spanType: SpanType.WORKFLOW_RUN, timeToFirstChunkMs: 100 }),
          root('b', 16, { timeToFirstChunkMs: 200 }),
          root('a', 15.1, {
            spanId: 'model',
            parentSpanId: 'root-a',
            spanType: SpanType.MODEL_GENERATION,
            attributes: { model: 'not-root-agent' },
          }),
        ],
      });
      expect((await query()).threads[0]).toMatchObject({ model: null, provider: null, timeToFirstChunkMs: null });
    });

    it('hydrates the maximum page and keeps the continuation', async () => {
      await getStorage().batchCreateSpans({
        records: Array.from({ length: 1001 }, (_, index) =>
          root(`trace-${index}`, 15, { threadId: `thread-${String(index).padStart(4, '0')}` }),
        ),
      });
      const first = await query({ page: { limit: 1000 } });
      expect(first.threads).toHaveLength(1000);
      expect(first.page.next).not.toBeNull();
      const next = await query({ page: { after: first.page.next! } });
      expect(next.threads.map(row => row.threadId)).toEqual(['thread-1000']);
      expect(next.page.next).toBeNull();
    });

    it('returns previews for legacy roots across payload batches without changing thread pagination', async () => {
      for (let index = 0; index < 36; index++) {
        const threadId = `legacy-${String(index).padStart(3, '0')}`;
        await options.writeSpanWithoutPreviews(root(`${threadId}-first`, 0, { threadId, input: `input ${index}` }));
        await options.writeSpanWithoutPreviews(
          root(`${threadId}-last`, 15, {
            threadId,
            output: `output ${index}`,
            error: { message: `failure ${index}` },
          }),
        );
      }
      const first = await query({ page: { limit: 35 } });
      expect(first.threads.map(row => [row.inputPreview, row.outputPreview])).toEqual(
        Array.from({ length: 35 }, (_, index) => [`input ${index}`, `output ${index}`]),
      );
      expect(first.threads.every(row => row.status === 'error' && row.errorPreview?.includes('failure'))).toBe(true);
      const next = await query({ page: { after: first.page.next! } });
      expect(next.threads).toHaveLength(1);
      expect(next.threads[0]).toMatchObject({ inputPreview: 'input 35', outputPreview: 'output 35', traceCount: 2 });
      expect(next.page.next).toBeNull();
    });

    it('uses the root agent own model generation instead of a nested processor model', async () => {
      await getStorage().batchCreateSpans({
        records: [
          root('a', 15),
          root('a', 15.1, { spanId: 'processor', parentSpanId: 'root-a' }),
          root('a', 15.2, {
            spanId: 'nested-model',
            parentSpanId: 'processor',
            spanType: SpanType.MODEL_GENERATION,
            attributes: { model: 'wrong', provider: 'wrong' },
          }),
          root('a', 15.3, {
            spanId: 'own-model',
            parentSpanId: 'root-a',
            spanType: SpanType.MODEL_GENERATION,
            attributes: { model: 'first-model', provider: 'first-provider' },
          }),
          root('a', 15.4, {
            spanId: 'later-model',
            parentSpanId: 'root-a',
            spanType: SpanType.MODEL_GENERATION,
            attributes: { model: 'later-model' },
          }),
        ],
      });
      expect((await query()).threads[0]).toMatchObject({ model: 'first-model', provider: 'first-provider' });
    });

    it('returns old first-trace previews and models despite clock skew or later resumed activity', async () => {
      const old = -30 * 86_400;
      await options.writeSpanWithoutPreviews(root('old', old, { input: 'old input' }));
      await options.writeSpanWithoutPreviews(root('recent', 15, { output: 'recent output' }));
      await getStorage().batchCreateSpans({
        records: [
          // End exactly one day before the root start to exercise the skew allowance inclusively.
          root('old', old - 86_400 - 1, {
            spanId: 'skewed-model',
            parentSpanId: 'root-old',
            spanType: SpanType.MODEL_GENERATION,
            attributes: { model: 'gpt-4o', provider: 'openai' },
          }),
          root('resumed', old, { threadId: 'resumed-thread' }),
          root('resumed-recent', 15, { threadId: 'resumed-thread' }),
          root('resumed', 86_400, {
            spanId: 'resumed-model',
            parentSpanId: 'root-resumed',
            spanType: SpanType.MODEL_GENERATION,
            attributes: { model: 'gpt-4o', provider: 'openai' },
          }),
        ],
      });
      const result = await query();
      expect(result.threads).toHaveLength(2);
      expect(result.threads.find(row => row.threadId === 'thread-a')).toMatchObject({
        firstTraceId: 'old',
        lastTraceId: 'recent',
        inputPreview: 'old input',
        outputPreview: 'recent output',
        model: 'gpt-4o',
        provider: 'openai',
      });
      expect(result.threads.find(row => row.threadId === 'resumed-thread')).toMatchObject({
        firstTraceId: 'resumed',
        model: 'gpt-4o',
        provider: 'openai',
      });
    });
  });
}
