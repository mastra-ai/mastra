import { EntityType, SpanType } from '@mastra/core/observability';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DuckDBStore } from '../../index';
import type { ObservabilityStorageDuckDB } from './index';

async function setupLegacyStore(): Promise<DuckDBStore> {
  const legacyStore = new DuckDBStore({ path: ':memory:' });

  await legacyStore.db.execute(`
    CREATE TABLE score_events (
      timestamp TIMESTAMP NOT NULL,
      traceId VARCHAR NOT NULL,
      spanId VARCHAR,
      experimentId VARCHAR,
      scoreTraceId VARCHAR,
      scorerId VARCHAR NOT NULL,
      scorerVersion VARCHAR,
      source VARCHAR,
      score DOUBLE NOT NULL,
      reason VARCHAR,
      metadata JSON
    )
  `);

  await legacyStore.db.execute(`
    CREATE TABLE feedback_events (
      timestamp TIMESTAMP NOT NULL,
      traceId VARCHAR NOT NULL,
      spanId VARCHAR,
      experimentId VARCHAR,
      userId VARCHAR,
      source VARCHAR,
      feedbackType VARCHAR NOT NULL,
      value VARCHAR NOT NULL,
      comment VARCHAR,
      metadata JSON
    )
  `);

  await expect(legacyStore.observability.init()).rejects.toThrow(/MIGRATION REQUIRED/);
  await legacyStore.observability.migrateSpans();
  await legacyStore.observability.init();

  return legacyStore;
}

describe('ObservabilityStorageDuckDB', () => {
  let store: DuckDBStore;
  let storage: ObservabilityStorageDuckDB;

  beforeAll(async () => {
    store = new DuckDBStore({ path: ':memory:' });
    storage = store.observability;
    await store.init();
  });

  beforeEach(async () => {
    await storage.dangerouslyClearAll();
  });

  afterAll(async () => {
    await store.db.close();
  });

  // ==========================================================================
  // Tracing Strategy
  // ==========================================================================

  it('reports event-sourced as preferred strategy', () => {
    expect(storage.tracingStrategy).toEqual({
      preferred: 'event-sourced',
      supported: ['event-sourced'],
    });
  });

  // ==========================================================================
  // Span Event Insertion + Reconstruction
  // ==========================================================================

  describe('span events', () => {
    const now = new Date();

    it('creates and reconstructs a span from start event', async () => {
      await storage.createSpan({
        span: {
          traceId: 'trace-1',
          spanId: 'span-1',
          parentSpanId: null,
          name: 'agent-run',
          spanType: SpanType.AGENT_RUN,
          isEvent: false,
          entityType: EntityType.AGENT,
          entityId: 'agent-1',
          entityName: 'myAgent',
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: 'test',
          source: null,
          serviceName: 'test-service',
          scope: null,
          attributes: { model: 'gpt-4' },
          metadata: { foo: 'bar' },
          tags: ['tag1', 'tag2'],
          links: null,
          input: { prompt: 'hello' },
          output: null,
          error: null,
          startedAt: now,
          endedAt: null,
        },
      });

      const result = await storage.getSpan({ traceId: 'trace-1', spanId: 'span-1' });
      expect(result).not.toBeNull();
      const span = result!.span;
      expect(span.name).toBe('agent-run');
      expect(span.traceId).toBe('trace-1');
      expect(span.spanId).toBe('span-1');
      expect(span.spanType).toBe('agent_run');
      expect(span.entityType).toBe('agent');
      expect(span.entityName).toBe('myAgent');
      expect(span.environment).toBe('test');
      expect(span.endedAt).toBeNull();
    });

    it('reconstructs a completed span from start and end rows only', async () => {
      await storage.createSpan({
        span: {
          traceId: 'trace-2',
          spanId: 'span-2',
          parentSpanId: null,
          name: 'tool-call',
          spanType: SpanType.TOOL_CALL,
          isEvent: false,
          entityType: EntityType.TOOL,
          entityId: 'tool-1',
          entityName: 'weather',
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: null,
          source: null,
          serviceName: null,
          scope: null,
          attributes: null,
          metadata: null,
          tags: null,
          links: null,
          input: { city: 'NYC' },
          output: { temp: 72 },
          error: null,
          startedAt: new Date('2026-01-01T00:00:00Z'),
          endedAt: new Date('2026-01-01T00:00:01Z'),
        },
      });

      const result = await storage.getSpan({ traceId: 'trace-2', spanId: 'span-2' });
      expect(result).not.toBeNull();
      const span = result!.span;
      expect(span.name).toBe('tool-call');
      expect(span.output).toEqual({ temp: 72 });
      expect(span.endedAt).toBeInstanceOf(Date);
    });

    it('does not support span updates for event-sourced tracing', async () => {
      await expect(
        storage.updateSpan({
          traceId: 'trace-2',
          spanId: 'span-2',
          updates: {
            output: { temp: 72 },
            endedAt: new Date('2026-01-01T00:00:01Z'),
          },
        }),
      ).rejects.toThrow('does not support updating spans');
    });

    it('batch creates and lists traces', async () => {
      await storage.batchCreateSpans({
        records: [
          {
            traceId: 'trace-3',
            spanId: 'root-span',
            parentSpanId: null,
            name: 'workflow-run',
            spanType: SpanType.WORKFLOW_RUN,
            isEvent: false,
            entityType: EntityType.WORKFLOW_RUN,
            entityId: 'wf-1',
            entityName: 'myWorkflow',
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: 'production',
            source: null,
            serviceName: 'svc',
            scope: null,
            attributes: null,
            metadata: null,
            tags: ['v1'],
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date('2026-01-01T00:00:00Z'),
            endedAt: null,
          },
          {
            traceId: 'trace-3',
            spanId: 'child-span',
            parentSpanId: 'root-span',
            name: 'agent-step',
            spanType: SpanType.AGENT_RUN,
            isEvent: false,
            entityType: EntityType.AGENT,
            entityId: 'agent-1',
            entityName: 'myAgent',
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: 'production',
            source: null,
            serviceName: 'svc',
            scope: null,
            attributes: null,
            metadata: null,
            tags: null,
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date('2026-01-01T00:00:01Z'),
            endedAt: null,
          },
        ],
      });

      const trace = await storage.getTrace({ traceId: 'trace-3' });
      expect(trace).not.toBeNull();
      expect(trace!.spans).toHaveLength(2);

      const rootResult = await storage.getRootSpan({ traceId: 'trace-3' });
      expect(rootResult).not.toBeNull();
      expect(rootResult!.span.name).toBe('workflow-run');
      expect(rootResult!.span.parentSpanId).toBeNull();

      const traces = await storage.listTraces({});
      expect(traces.spans.length).toBeGreaterThanOrEqual(1);
    });

    it('listTraces applies scalar prefilter and tag post-filter correctly', async () => {
      await storage.batchCreateSpans({
        records: [
          {
            traceId: 'trace-scalar-a',
            spanId: 'root-a',
            parentSpanId: null,
            name: 'agent-run',
            spanType: SpanType.AGENT_RUN,
            isEvent: false,
            entityType: EntityType.AGENT,
            entityId: 'agent-a',
            entityName: 'agentA',
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: 'production',
            source: null,
            serviceName: 'svc-a',
            scope: null,
            attributes: null,
            metadata: null,
            tags: ['keep'],
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date('2026-01-02T00:00:00Z'),
            endedAt: new Date('2026-01-02T00:00:02Z'),
          },
          {
            traceId: 'trace-scalar-b',
            spanId: 'root-b',
            parentSpanId: null,
            name: 'agent-run',
            spanType: SpanType.AGENT_RUN,
            isEvent: false,
            entityType: EntityType.AGENT,
            entityId: 'agent-b',
            entityName: 'agentB',
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: 'staging',
            source: null,
            serviceName: 'svc-b',
            scope: null,
            attributes: null,
            metadata: null,
            tags: ['skip'],
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date('2026-01-02T00:00:05Z'),
            endedAt: new Date('2026-01-02T00:00:06Z'),
          },
        ],
      });

      // Fast path — scalar-only filter (no post-agg).
      const byEnv = await storage.listTraces({
        filters: { environment: 'production', startedAt: { start: new Date('2026-01-02T00:00:00Z') } },
      });
      const envTraceIds = byEnv.spans.map(s => s.traceId);
      expect(envTraceIds).toContain('trace-scalar-a');
      expect(envTraceIds).not.toContain('trace-scalar-b');

      // Slow path — post-agg tag filter combined with scalar startedAt.
      const byTag = await storage.listTraces({
        filters: { tags: ['keep'], startedAt: { start: new Date('2026-01-02T00:00:00Z') } },
      });
      const tagTraceIds = byTag.spans.map(s => s.traceId);
      expect(tagTraceIds).toContain('trace-scalar-a');
      expect(tagTraceIds).not.toContain('trace-scalar-b');
    });

    it('listTraces intersects startedAt and endedAt upper bounds on the prefilter', async () => {
      // Span A starts at 12:00 and ends at 12:01 — fits inside both ranges.
      // Span B starts at 12:30 (outside startedAt) and ends at 12:35 (inside
      // endedAt). With a buggy partition that overwrites the prefilter end
      // bound, span B would leak through; with the intersection fix it stays
      // out.
      await storage.batchCreateSpans({
        records: [
          {
            traceId: 'trace-bound-a',
            spanId: 'root-a',
            parentSpanId: null,
            name: 'within-window',
            spanType: SpanType.AGENT_RUN,
            isEvent: false,
            entityType: EntityType.AGENT,
            entityId: 'agent-a',
            entityName: 'agentA',
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: null,
            source: null,
            serviceName: null,
            scope: null,
            attributes: null,
            metadata: null,
            tags: null,
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date('2026-02-01T12:00:00Z'),
            endedAt: new Date('2026-02-01T12:01:00Z'),
          },
          {
            traceId: 'trace-bound-b',
            spanId: 'root-b',
            parentSpanId: null,
            name: 'started-after-startedAt-end',
            spanType: SpanType.AGENT_RUN,
            isEvent: false,
            entityType: EntityType.AGENT,
            entityId: 'agent-b',
            entityName: 'agentB',
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: null,
            source: null,
            serviceName: null,
            scope: null,
            attributes: null,
            metadata: null,
            tags: null,
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date('2026-02-01T12:30:00Z'),
            endedAt: new Date('2026-02-01T12:35:00Z'),
          },
        ],
      });

      const filters = {
        startedAt: { end: new Date('2026-02-01T12:10:00Z') },
        endedAt: { end: new Date('2026-02-01T13:00:00Z') },
      };
      const tightUpperBound = await storage.listTraces({ filters });
      const traceIds = tightUpperBound.spans.map(s => s.traceId);
      expect(traceIds).toContain('trace-bound-a');
      expect(traceIds).not.toContain('trace-bound-b');

      // Same query with keys reversed — JS `Object.entries` iterates insertion
      // order, so this exercises the other partition path.
      const filtersReversed = {
        endedAt: { end: new Date('2026-02-01T13:00:00Z') },
        startedAt: { end: new Date('2026-02-01T12:10:00Z') },
      };
      const reversed = await storage.listTraces({ filters: filtersReversed });
      const reversedIds = reversed.spans.map(s => s.traceId);
      expect(reversedIds).toContain('trace-bound-a');
      expect(reversedIds).not.toContain('trace-bound-b');
    });

    it('batch deletes traces', async () => {
      await storage.createSpan({
        span: {
          traceId: 'trace-del',
          spanId: 'span-del',
          parentSpanId: null,
          name: 'delete-me',
          spanType: SpanType.AGENT_RUN,
          isEvent: false,
          entityType: null,
          entityId: null,
          entityName: null,
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: null,
          source: null,
          serviceName: null,
          scope: null,
          attributes: null,
          metadata: null,
          tags: null,
          links: null,
          input: null,
          output: null,
          error: null,
          startedAt: now,
          endedAt: null,
        },
      });

      await storage.batchDeleteTraces({ traceIds: ['trace-del'] });
      const result = await storage.getSpan({ traceId: 'trace-del', spanId: 'span-del' });
      expect(result).toBeNull();
    });
  });

  it('requires manual migration for legacy score and feedback tables before init', async () => {
    const legacyStore = await setupLegacyStore();

    await legacyStore.observability.batchCreateScores({
      scores: [
        {
          scoreId: 'legacy-score-1',
          timestamp: new Date('2026-01-01T00:00:00Z'),
          traceId: 'legacy-trace',
          spanId: 'legacy-span',
          scorerId: 'legacy-scorer',
          scoreSource: 'manual',
          score: 0.7,
          entityType: EntityType.AGENT,
          entityName: 'legacy-agent',
          executionSource: 'cloud',
          scope: { phase: 'test' },
          metadata: { migrated: true },
        },
      ],
    });

    await legacyStore.observability.batchCreateFeedback({
      feedbacks: [
        {
          feedbackId: 'legacy-feedback-1',
          timestamp: new Date('2026-01-01T00:00:00Z'),
          traceId: 'legacy-trace',
          feedbackType: 'thumbs',
          value: 1,
          feedbackSource: 'user',
          feedbackUserId: 'user-1',
          entityType: EntityType.AGENT,
          entityName: 'legacy-agent',
          executionSource: 'cloud',
          scope: { phase: 'test' },
          metadata: { migrated: true },
        },
      ],
    });

    const scores = await legacyStore.observability.listScores({
      filters: { traceId: 'legacy-trace' },
      pagination: { page: 0, perPage: 10 },
      orderBy: { field: 'timestamp', direction: 'ASC' },
    });

    const feedback = await legacyStore.observability.listFeedback({
      filters: { traceId: 'legacy-trace' },
      pagination: { page: 0, perPage: 10 },
      orderBy: { field: 'timestamp', direction: 'ASC' },
    });

    expect(scores.scores[0]).toMatchObject({
      traceId: 'legacy-trace',
      spanId: 'legacy-span',
      scorerId: 'legacy-scorer',
      scoreSource: 'manual',
      source: 'manual',
      executionSource: 'cloud',
      entityType: EntityType.AGENT,
      entityName: 'legacy-agent',
      scope: { phase: 'test' },
    });

    expect(feedback.feedback[0]).toMatchObject({
      traceId: 'legacy-trace',
      feedbackType: 'thumbs',
      feedbackSource: 'user',
      source: 'user',
      feedbackUserId: 'user-1',
      executionSource: 'cloud',
      entityType: EntityType.AGENT,
      entityName: 'legacy-agent',
      scope: { phase: 'test' },
    });

    await legacyStore.db.close();
  });

  it('relaxes legacy score and feedback traceId columns during manual migration', async () => {
    const legacyStore = await setupLegacyStore();

    await legacyStore.observability.createScore({
      score: {
        scoreId: 'legacy-score-null-trace',
        timestamp: new Date('2026-01-01T00:00:00Z'),
        traceId: null,
        spanId: null,
        scorerId: 'quality',
        scoreSource: 'automated',
        score: 0.8,
        reason: null,
        experimentId: null,
        metadata: null,
      } as any,
    });

    await legacyStore.observability.createFeedback({
      feedback: {
        feedbackId: 'legacy-feedback-null-trace',
        timestamp: new Date('2026-01-01T00:00:00Z'),
        traceId: null,
        spanId: null,
        feedbackSource: 'manual',
        feedbackType: 'rating',
        value: 5,
        comment: null,
        experimentId: null,
        sourceId: null,
        metadata: null,
      } as any,
    });

    const scores = await legacyStore.observability.listScores({});
    const feedback = await legacyStore.observability.listFeedback({});

    expect(scores.scores[0]!.traceId).toBeNull();
    expect(feedback.feedback[0]!.traceId).toBeNull();

    await legacyStore.db.close();
  });

  // ==========================================================================
  // Trace branches
  // ==========================================================================

  describe('branches', () => {
    /** Helper to fill a span record's required nullable fields. */
    const baseSpan = {
      userId: null,
      organizationId: null,
      resourceId: null,
      runId: null,
      sessionId: null,
      threadId: null,
      requestId: null,
      environment: null,
      source: null,
      serviceName: null,
      scope: null,
      attributes: null,
      metadata: null,
      tags: null,
      links: null,
      input: null,
      output: null,
      error: null,
      isEvent: false,
      entityType: null,
      entityId: null,
      entityName: null,
    } as const;

    it('listBranches surfaces nested anchors that listTraces would miss', async () => {
      // orderWorkflow → Observer (nested AGENT_RUN, twice) and a tool call.
      // Plus a model_step which must NOT appear (sub-operation).
      await storage.batchCreateSpans({
        records: [
          {
            ...baseSpan,
            traceId: 'br-1',
            spanId: 'root',
            parentSpanId: null,
            name: 'orderWorkflow',
            spanType: SpanType.WORKFLOW_RUN,
            entityType: EntityType.WORKFLOW_RUN,
            entityId: 'wf-1',
            entityName: 'orderWorkflow',
            startedAt: new Date('2026-04-01T12:00:00Z'),
            endedAt: new Date('2026-04-01T12:00:10Z'),
          },
          {
            ...baseSpan,
            traceId: 'br-1',
            spanId: 'observer-1',
            parentSpanId: 'root',
            name: 'Observer',
            spanType: SpanType.AGENT_RUN,
            entityType: EntityType.AGENT,
            entityId: 'agent-observer',
            entityName: 'Observer',
            startedAt: new Date('2026-04-01T12:00:01Z'),
            endedAt: new Date('2026-04-01T12:00:03Z'),
          },
          {
            ...baseSpan,
            traceId: 'br-1',
            spanId: 'observer-2',
            parentSpanId: 'root',
            name: 'Observer',
            spanType: SpanType.AGENT_RUN,
            entityType: EntityType.AGENT,
            entityId: 'agent-observer',
            entityName: 'Observer',
            startedAt: new Date('2026-04-01T12:00:05Z'),
            endedAt: new Date('2026-04-01T12:00:07Z'),
          },
          {
            ...baseSpan,
            traceId: 'br-1',
            spanId: 'search-1',
            parentSpanId: 'observer-1',
            name: 'web_search',
            spanType: SpanType.TOOL_CALL,
            entityType: EntityType.TOOL,
            entityId: 'tool-web-search',
            entityName: 'web_search',
            startedAt: new Date('2026-04-01T12:00:02Z'),
            endedAt: new Date('2026-04-01T12:00:02.500Z'),
          },
          {
            ...baseSpan,
            traceId: 'br-1',
            spanId: 'model-step-1',
            parentSpanId: 'observer-1',
            name: 'gpt-4-call',
            spanType: SpanType.MODEL_STEP, // sub-operation: must NOT appear
            startedAt: new Date('2026-04-01T12:00:02.250Z'),
            endedAt: new Date('2026-04-01T12:00:02.400Z'),
          },
        ],
      });

      // Should see: 1 workflow_run + 2 agent_run + 1 tool_call = 4. The
      // MODEL_STEP is excluded by the spanType prefilter.
      const all = await storage.listBranches({ pagination: { perPage: 100 } });
      expect(all.branches).toHaveLength(4);
      expect(all.branches.map(b => b.spanType).sort()).toEqual(['agent_run', 'agent_run', 'tool_call', 'workflow_run']);

      // listTraces({ entityName: 'Observer' }) returns nothing since Observer
      // is never a root span -- this is the gap listBranches closes.
      const traces = await storage.listTraces({ filters: { entityName: 'Observer' } });
      expect(traces.spans).toHaveLength(0);

      const observerBranches = await storage.listBranches({ filters: { entityName: 'Observer' } });
      expect(observerBranches.branches).toHaveLength(2);
      expect(observerBranches.branches.every(b => b.entityName === 'Observer')).toBe(true);
    });

    it('listBranches narrows by spanType and respects pagination', async () => {
      const baseStartedAt = new Date('2026-04-02T10:00:00Z').getTime();
      const toolRecords = Array.from({ length: 5 }, (_, i) => ({
        ...baseSpan,
        traceId: `pag-${i}`,
        spanId: `tool-${i}`,
        parentSpanId: null,
        name: `tool-${i}`,
        spanType: SpanType.TOOL_CALL,
        entityType: EntityType.TOOL,
        entityId: 'web_search',
        entityName: 'web_search',
        startedAt: new Date(baseStartedAt + i * 1000),
        endedAt: new Date(baseStartedAt + i * 1000 + 500),
      }));
      // Plus a MODEL_STEP span so the "non-branch types yield nothing"
      // assertion below isn't vacuous -- the row exists in span_events but
      // listBranches must not surface it (MODEL_STEP isn't a branch anchor).
      const modelStepRecord = {
        ...baseSpan,
        traceId: 'pag-model',
        spanId: 'model-step-1',
        parentSpanId: 'pag-model-root',
        name: 'gpt-4-call',
        spanType: SpanType.MODEL_STEP,
        startedAt: new Date(baseStartedAt + 100),
        endedAt: new Date(baseStartedAt + 200),
      };
      await storage.batchCreateSpans({ records: [...toolRecords, modelStepRecord] });

      const onlyTools = await storage.listBranches({
        filters: { spanType: SpanType.TOOL_CALL, entityName: 'web_search' },
        pagination: { page: 0, perPage: 2 },
      });
      expect(onlyTools.branches).toHaveLength(2);
      expect(onlyTools.pagination.total).toBe(5);
      expect(onlyTools.pagination.hasMore).toBe(true);

      const page2 = await storage.listBranches({
        filters: { spanType: SpanType.TOOL_CALL, entityName: 'web_search' },
        pagination: { page: 2, perPage: 2 },
      });
      expect(page2.branches).toHaveLength(1);
      expect(page2.pagination.hasMore).toBe(false);

      // Sub-operation span types yield nothing even when explicitly asked for,
      // even though a MODEL_STEP row exists in span_events.
      const noModelSteps = await storage.listBranches({
        filters: { spanType: SpanType.MODEL_STEP },
      });
      expect(noModelSteps.branches).toHaveLength(0);

      // Unfiltered listBranches must also exclude the MODEL_STEP row -- only
      // the 5 TOOL_CALL anchors should surface.
      const allBranches = await storage.listBranches({ pagination: { perPage: 100 } });
      expect(allBranches.branches.every(b => b.spanType === SpanType.TOOL_CALL)).toBe(true);
      expect(allBranches.branches).toHaveLength(5);
    });

    it('listBranches applies scalar prefilter and tag post-filter correctly', async () => {
      await storage.batchCreateSpans({
        records: [
          {
            ...baseSpan,
            traceId: 'br-scalar-a',
            spanId: 'agent-a',
            parentSpanId: 'root-a',
            name: 'nested-agent',
            spanType: SpanType.AGENT_RUN,
            entityType: EntityType.AGENT,
            entityId: 'agent-a',
            entityName: 'agentA',
            environment: 'production',
            serviceName: 'svc-a',
            tags: ['keep'],
            startedAt: new Date('2026-04-03T00:00:00Z'),
            endedAt: new Date('2026-04-03T00:00:02Z'),
          },
          {
            ...baseSpan,
            traceId: 'br-scalar-b',
            spanId: 'agent-b',
            parentSpanId: 'root-b',
            name: 'nested-agent',
            spanType: SpanType.AGENT_RUN,
            entityType: EntityType.AGENT,
            entityId: 'agent-b',
            entityName: 'agentB',
            environment: 'staging',
            serviceName: 'svc-b',
            tags: ['skip'],
            startedAt: new Date('2026-04-03T00:00:05Z'),
            endedAt: new Date('2026-04-03T00:00:06Z'),
          },
        ],
      });

      // Fast path — scalar-only filter (no post-agg).
      const byEnv = await storage.listBranches({
        filters: { environment: 'production', startedAt: { start: new Date('2026-04-03T00:00:00Z') } },
      });
      const envSpanIds = byEnv.branches.map(b => b.spanId);
      expect(envSpanIds).toContain('agent-a');
      expect(envSpanIds).not.toContain('agent-b');

      // Slow path — post-agg tag filter combined with scalar startedAt.
      const byTag = await storage.listBranches({
        filters: { tags: ['keep'], startedAt: { start: new Date('2026-04-03T00:00:00Z') } },
      });
      const tagSpanIds = byTag.branches.map(b => b.spanId);
      expect(tagSpanIds).toContain('agent-a');
      expect(tagSpanIds).not.toContain('agent-b');
    });

    it('getSpans batch-fetches a subset of spans within a trace', async () => {
      await storage.batchCreateSpans({
        records: [
          {
            ...baseSpan,
            traceId: 'gs-1',
            spanId: 'a',
            parentSpanId: null,
            name: 'a',
            spanType: SpanType.AGENT_RUN,
            input: { prompt: 'hi' },
            startedAt: new Date('2026-04-04T00:00:00Z'),
            endedAt: new Date('2026-04-04T00:00:01Z'),
          },
          {
            ...baseSpan,
            traceId: 'gs-1',
            spanId: 'b',
            parentSpanId: 'a',
            name: 'b',
            spanType: SpanType.TOOL_CALL,
            startedAt: new Date('2026-04-04T00:00:02Z'),
            endedAt: new Date('2026-04-04T00:00:03Z'),
          },
          {
            ...baseSpan,
            traceId: 'gs-1',
            spanId: 'c',
            parentSpanId: 'a',
            name: 'c',
            spanType: SpanType.TOOL_CALL,
            startedAt: new Date('2026-04-04T00:00:04Z'),
            endedAt: new Date('2026-04-04T00:00:05Z'),
          },
        ],
      });

      const result = await storage.getSpans({ traceId: 'gs-1', spanIds: ['a', 'c'] });
      expect(result.traceId).toBe('gs-1');
      expect(result.spans.map(s => s.spanId).sort()).toEqual(['a', 'c']);
      // Heavy fields populated (the differentiator from getStructure).
      const a = result.spans.find(s => s.spanId === 'a')!;
      expect(a.input).toEqual({ prompt: 'hi' });

      const empty = await storage.getSpans({ traceId: 'no-such', spanIds: ['x'] });
      expect(empty.spans).toEqual([]);
    });

    it('getBranch uses the optimized two-step path on DuckDB', async () => {
      // root → A (1) → A1
      //              → A1a (model_step, included via subtree)
      //      → B (1) → B1
      await storage.batchCreateSpans({
        records: [
          {
            ...baseSpan,
            traceId: 'gb-1',
            spanId: 'root',
            parentSpanId: null,
            name: 'root',
            spanType: SpanType.WORKFLOW_RUN,
            startedAt: new Date('2026-04-05T00:00:00Z'),
            endedAt: new Date('2026-04-05T00:00:10Z'),
          },
          {
            ...baseSpan,
            traceId: 'gb-1',
            spanId: 'A',
            parentSpanId: 'root',
            name: 'A',
            spanType: SpanType.AGENT_RUN,
            startedAt: new Date('2026-04-05T00:00:01Z'),
            endedAt: new Date('2026-04-05T00:00:05Z'),
          },
          {
            ...baseSpan,
            traceId: 'gb-1',
            spanId: 'A1',
            parentSpanId: 'A',
            name: 'A1',
            spanType: SpanType.TOOL_CALL,
            startedAt: new Date('2026-04-05T00:00:02Z'),
            endedAt: new Date('2026-04-05T00:00:03Z'),
          },
          {
            ...baseSpan,
            traceId: 'gb-1',
            spanId: 'A1a',
            parentSpanId: 'A1',
            name: 'A1a',
            spanType: SpanType.MODEL_STEP,
            startedAt: new Date('2026-04-05T00:00:02.500Z'),
            endedAt: new Date('2026-04-05T00:00:02.800Z'),
          },
          {
            ...baseSpan,
            traceId: 'gb-1',
            spanId: 'B',
            parentSpanId: 'root',
            name: 'B',
            spanType: SpanType.AGENT_RUN,
            startedAt: new Date('2026-04-05T00:00:06Z'),
            endedAt: new Date('2026-04-05T00:00:09Z'),
          },
        ],
      });

      const fullA = await storage.getBranch({ traceId: 'gb-1', spanId: 'A' });
      expect(fullA!.spans.map(s => s.spanId).sort()).toEqual(['A', 'A1', 'A1a']);

      const depth1 = await storage.getBranch({ traceId: 'gb-1', spanId: 'A', depth: 1 });
      expect(depth1!.spans.map(s => s.spanId).sort()).toEqual(['A', 'A1']);

      const depth0 = await storage.getBranch({ traceId: 'gb-1', spanId: 'A', depth: 0 });
      expect(depth0!.spans.map(s => s.spanId)).toEqual(['A']);

      const missing = await storage.getBranch({ traceId: 'gb-1', spanId: 'nonexistent' });
      expect(missing).toBeNull();
    });
  });

  // ==========================================================================
  // Logs
  // ==========================================================================

  describe('logs', () => {
    it('creates and lists logs', async () => {
      await storage.batchCreateLogs({
        logs: [
          {
            logId: 'log-test-1',
            timestamp: new Date(),
            level: 'info',
            message: 'Test log message',
            data: { key: 'value' },
            traceId: 'trace-1',
            spanId: 'span-1',
            tags: ['test'],
            entityType: EntityType.AGENT,
            entityId: 'agent-1',
            entityName: 'myAgent',
            metadata: null,
          },
          {
            logId: 'log-test-2',
            timestamp: new Date(),
            level: 'error',
            message: 'Error occurred',
            data: null,
            traceId: 'trace-1',
            spanId: null,
            tags: null,
            metadata: null,
          },
        ],
      });

      const result = await storage.listLogs({});
      expect(result.logs).toHaveLength(2);

      const filtered = await storage.listLogs({
        filters: { level: 'error' },
      });
      expect(filtered.logs).toHaveLength(1);
      expect(filtered.logs[0]!.message).toBe('Error occurred');
    });
  });

  // ==========================================================================
  // Metrics + OLAP Queries
  // ==========================================================================

  describe('metrics', () => {
    beforeEach(async () => {
      // Insert sample metrics
      await storage.batchCreateMetrics({
        metrics: [
          {
            metricId: 'metric-test-1',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            name: 'mastra_agent_duration_ms',
            value: 100,
            labels: { status: 'ok' },
            provider: 'openai',
            model: 'gpt-4o-mini',
            estimatedCost: 0.1,
            costUnit: 'usd',
            tags: ['prod'],
            entityType: EntityType.AGENT,
            entityName: 'weatherAgent',
          },
          {
            metricId: 'metric-test-2',
            timestamp: new Date('2026-01-01T00:00:05Z'),
            name: 'mastra_agent_duration_ms',
            value: 200,
            labels: { status: 'ok' },
            provider: 'openai',
            model: 'gpt-4o-mini',
            estimatedCost: 0.2,
            costUnit: 'usd',
            tags: ['prod'],
            entityType: EntityType.AGENT,
            entityName: 'weatherAgent',
          },
          {
            metricId: 'metric-test-3',
            timestamp: new Date('2026-01-01T00:00:10Z'),
            name: 'mastra_agent_duration_ms',
            value: 500,
            labels: { status: 'error' },
            provider: 'anthropic',
            model: 'claude-3-7-sonnet',
            estimatedCost: 0.5,
            costUnit: 'usd',
            tags: ['prod'],
            entityType: EntityType.AGENT,
            entityName: 'codeAgent',
          },
          {
            metricId: 'metric-test-4',
            timestamp: new Date('2026-01-01T01:00:00Z'),
            name: 'mastra_tool_calls_started',
            value: 1,
            labels: {},
            tags: ['prod'],
            entityType: EntityType.TOOL,
            entityName: 'search',
          },
        ],
      });
    });

    it('getMetricAggregate returns sum', async () => {
      const result = await storage.getMetricAggregate({
        name: ['mastra_agent_duration_ms'],
        aggregation: 'sum',
      });
      expect(result.value).toBe(800); // 100 + 200 + 500
      expect(result.estimatedCost).toBeCloseTo(0.8);
      expect(result.costUnit).toBe('usd');
    });

    it('listMetrics returns paginated metric records with shared filters', async () => {
      const result = await storage.listMetrics({
        filters: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          tags: ['prod'],
        },
        pagination: { page: 0, perPage: 1 },
        orderBy: { field: 'timestamp', direction: 'ASC' },
      });

      expect(result.pagination.total).toBe(2);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.metrics).toHaveLength(1);
      expect(result.metrics[0]!.provider).toBe('openai');
      expect(result.metrics[0]!.model).toBe('gpt-4o-mini');
      expect(result.metrics[0]!.estimatedCost).toBeCloseTo(0.1);
      expect(result.metrics[0]!.costUnit).toBe('usd');
      expect(result.metrics[0]!.tags).toEqual(['prod']);
      expect(result.metrics[0]!.labels).toEqual({ status: 'ok' });
    });

    it('getMetricAggregate returns avg', async () => {
      const result = await storage.getMetricAggregate({
        name: ['mastra_agent_duration_ms'],
        aggregation: 'avg',
      });
      expect(result.value).toBeCloseTo(266.67, 0);
    });

    it('getMetricAggregate returns count', async () => {
      const result = await storage.getMetricAggregate({
        name: ['mastra_agent_duration_ms'],
        aggregation: 'count',
      });
      expect(result.value).toBe(3);
    });

    it('getMetricBreakdown groups by entityName', async () => {
      const result = await storage.getMetricBreakdown({
        name: ['mastra_agent_duration_ms'],
        groupBy: ['entityName'],
        aggregation: 'avg',
      });
      expect(result.groups).toHaveLength(2);
      const weather = result.groups.find(g => g.dimensions.entityName === 'weatherAgent');
      const code = result.groups.find(g => g.dimensions.entityName === 'codeAgent');
      expect(weather).toBeDefined();
      expect(weather!.value).toBe(150); // (100+200)/2
      expect(weather!.estimatedCost).toBeCloseTo(0.3);
      expect(weather!.costUnit).toBe('usd');
      expect(code).toBeDefined();
      expect(code!.value).toBe(500);
      expect(code!.estimatedCost).toBeCloseTo(0.5);
      expect(code!.costUnit).toBe('usd');
    });

    it('getMetricBreakdown groups by label keys', async () => {
      const result = await storage.getMetricBreakdown({
        name: ['mastra_agent_duration_ms'],
        groupBy: ['status'],
        aggregation: 'count',
      });

      expect(result.groups).toHaveLength(2);
      const ok = result.groups.find(g => g.dimensions.status === 'ok');
      const error = result.groups.find(g => g.dimensions.status === 'error');

      expect(ok?.value).toBe(2);
      expect(ok?.estimatedCost).toBeCloseTo(0.3);
      expect(error?.value).toBe(1);
      expect(error?.estimatedCost).toBeCloseTo(0.5);
    });

    it('getMetricBreakdown accepts discovered label keys with non-identifier characters', async () => {
      await storage.batchCreateMetrics({
        metrics: [
          {
            metricId: 'metric-test-5',
            timestamp: new Date('2026-01-01T00:00:20Z'),
            name: 'mastra_agent_duration_ms',
            value: 300,
            labels: { 'foo-bar': 'alpha' },
            entityType: EntityType.AGENT,
            entityName: 'weatherAgent',
          },
          {
            metricId: 'metric-test-6',
            timestamp: new Date('2026-01-01T00:00:25Z'),
            name: 'mastra_agent_duration_ms',
            value: 400,
            labels: { 'foo-bar': 'beta' },
            entityType: EntityType.AGENT,
            entityName: 'codeAgent',
          },
        ],
      });

      const keys = await storage.getMetricLabelKeys({ metricName: 'mastra_agent_duration_ms' });
      expect(keys.keys).toContain('foo-bar');

      const result = await storage.getMetricBreakdown({
        name: ['mastra_agent_duration_ms'],
        groupBy: ['foo-bar'],
        aggregation: 'count',
      });

      const alpha = result.groups.find(group => group.dimensions['foo-bar'] === 'alpha');
      const beta = result.groups.find(group => group.dimensions['foo-bar'] === 'beta');
      const missing = result.groups.find(group => group.dimensions['foo-bar'] === null);

      expect(alpha?.value).toBe(1);
      expect(beta?.value).toBe(1);
      expect(missing?.value).toBe(3);
    });

    it('getMetricTimeSeries returns bucketed data', async () => {
      const result = await storage.getMetricTimeSeries({
        name: ['mastra_agent_duration_ms'],
        interval: '1h',
        aggregation: 'sum',
      });
      expect(result.series.length).toBeGreaterThanOrEqual(1);
      const mainSeries = result.series[0]!;
      expect(mainSeries.points.length).toBeGreaterThanOrEqual(1);
      expect(mainSeries.costUnit).toBe('usd');
      expect(mainSeries.points[0]!.estimatedCost).toBeCloseTo(0.8);
    });

    it('getMetricTimeSeries keeps colliding display names as separate grouped series', async () => {
      await storage.batchCreateMetrics({
        metrics: [
          {
            metricId: 'metric-test-5',
            timestamp: new Date('2026-01-01T02:00:00Z'),
            name: 'mastra_collision_metric',
            value: 10,
            labels: { segmentA: 'a', segmentB: 'b|c' },
            entityType: EntityType.TOOL,
            entityName: 'search',
          },
          {
            metricId: 'metric-test-6',
            timestamp: new Date('2026-01-01T02:00:00Z'),
            name: 'mastra_collision_metric',
            value: 20,
            labels: { segmentA: 'a|b', segmentB: 'c' },
            entityType: EntityType.TOOL,
            entityName: 'search',
          },
        ],
      });

      const result = await storage.getMetricTimeSeries({
        name: ['mastra_collision_metric'],
        interval: '1h',
        aggregation: 'sum',
        groupBy: ['segmentA', 'segmentB'],
      });

      expect(result.series).toHaveLength(2);
      expect(result.series.every(series => series.name === 'a|b|c')).toBe(true);
      expect(result.series.map(series => series.points.length)).toEqual([1, 1]);
      expect(result.series.map(series => series.points[0]!.value).sort((left, right) => left - right)).toEqual([
        10, 20,
      ]);
    });

    it('filters metrics by canonical cost fields', async () => {
      const result = await storage.getMetricAggregate({
        name: ['mastra_agent_duration_ms'],
        aggregation: 'sum',
        filters: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          costUnit: 'usd',
        },
      });

      expect(result.value).toBe(300);
      expect(result.estimatedCost).toBeCloseTo(0.3);
    });

    it('getMetricPercentiles returns percentile series', async () => {
      const result = await storage.getMetricPercentiles({
        name: 'mastra_agent_duration_ms',
        percentiles: [0.5, 0.99],
        interval: '1h',
      });
      expect(result.series).toHaveLength(2);
      const p50 = result.series.find(s => s.percentile === 0.5);
      expect(p50).toBeDefined();
    });
  });

  // ==========================================================================
  // Discovery Methods
  // ==========================================================================

  describe('discovery', () => {
    beforeEach(async () => {
      await storage.batchCreateMetrics({
        metrics: [
          {
            metricId: 'metric-test-1',
            timestamp: new Date(),
            name: 'mastra_agent_duration_ms',
            value: 100,
            labels: { agent: 'weatherAgent', status: 'ok' },
            entityType: EntityType.AGENT,
            entityName: 'weatherAgent',
            serviceName: 'metric-service',
            environment: 'metric-env',
            tags: ['metric-tag'],
          },
          {
            metricId: 'metric-test-2',
            timestamp: new Date(),
            name: 'mastra_tool_calls_started',
            value: 1,
            labels: { tool: 'search' },
            entityType: EntityType.TOOL,
            entityName: 'metricTool',
            serviceName: 'metric-service',
            environment: 'metric-env',
            tags: ['metric-tag'],
          },
        ],
      });

      await storage.batchCreateLogs({
        logs: [
          {
            logId: 'log-test-1',
            timestamp: new Date(),
            level: 'info',
            message: 'discovery-log',
            data: null,
            entityType: EntityType.INPUT_PROCESSOR,
            entityName: 'logProcessor',
            serviceName: 'log-service',
            environment: 'log-env',
            tags: ['log-tag'],
            metadata: null,
          },
        ],
      });

      await storage.batchCreateSpans({
        records: [
          {
            traceId: 'disc-trace',
            spanId: 'disc-span',
            parentSpanId: null,
            name: 'test',
            spanType: SpanType.AGENT_RUN,
            isEvent: false,
            entityType: EntityType.AGENT,
            entityId: 'a-1',
            entityName: 'weatherAgent',
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: 'production',
            source: null,
            serviceName: 'my-service',
            scope: null,
            attributes: null,
            metadata: null,
            tags: ['v1', 'experiment'],
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date(),
            endedAt: null,
          },
        ],
      });
    });

    it('getMetricNames returns distinct names', async () => {
      const result = await storage.getMetricNames({});
      expect(result.names).toContain('mastra_agent_duration_ms');
      expect(result.names).toContain('mastra_tool_calls_started');
    });

    it('getMetricNames filters by prefix', async () => {
      const result = await storage.getMetricNames({ prefix: 'mastra_agent' });
      expect(result.names).toContain('mastra_agent_duration_ms');
      expect(result.names).not.toContain('mastra_tool_calls_started');
    });

    it('getMetricLabelKeys returns label keys', async () => {
      const result = await storage.getMetricLabelKeys({ metricName: 'mastra_agent_duration_ms' });
      expect(result.keys).toContain('agent');
      expect(result.keys).toContain('status');
    });

    it('getMetricLabelValues returns values for a label key', async () => {
      const result = await storage.getMetricLabelValues({
        metricName: 'mastra_agent_duration_ms',
        labelKey: 'status',
      });
      expect(result.values).toContain('ok');
    });

    it('getEntityTypes returns distinct entity types', async () => {
      const result = await storage.getEntityTypes({});
      expect(result.entityTypes).toContain('agent');
      expect(result.entityTypes).toContain('tool');
      expect(result.entityTypes).toContain('input_processor');
    });

    it('getEntityNames returns entity names', async () => {
      const result = await storage.getEntityNames({ entityType: EntityType.AGENT });
      expect(result.names).toContain('weatherAgent');

      const toolNames = await storage.getEntityNames({ entityType: EntityType.TOOL });
      expect(toolNames.names).toContain('metricTool');

      const processorNames = await storage.getEntityNames({ entityType: EntityType.INPUT_PROCESSOR });
      expect(processorNames.names).toContain('logProcessor');
    });

    it('getServiceNames returns service names', async () => {
      const result = await storage.getServiceNames({});
      expect(result.serviceNames).toContain('my-service');
      expect(result.serviceNames).toContain('metric-service');
      expect(result.serviceNames).toContain('log-service');
    });

    it('getEnvironments returns environments', async () => {
      const result = await storage.getEnvironments({});
      expect(result.environments).toContain('production');
      expect(result.environments).toContain('metric-env');
      expect(result.environments).toContain('log-env');
    });

    it('getTags returns distinct tags', async () => {
      const result = await storage.getTags({});
      expect(result.tags).toContain('v1');
      expect(result.tags).toContain('experiment');
      expect(result.tags).toContain('metric-tag');
      expect(result.tags).toContain('log-tag');
    });
  });

  // ==========================================================================
  // Scores
  // ==========================================================================

  describe('scores', () => {
    it('creates and lists scores', async () => {
      await storage.createScore({
        score: {
          scoreId: 'score-test-1',
          timestamp: new Date(),
          traceId: 'trace-1',
          spanId: null,
          scorerId: 'relevance',
          score: 0.85,
          reason: 'Good answer',
          experimentId: 'exp-1',
          metadata: { entityType: 'agent' },
        },
      });

      await storage.createScore({
        score: {
          scoreId: 'score-test-2',
          timestamp: new Date(),
          traceId: 'trace-1',
          spanId: 'span-1',
          scorerId: 'factuality',
          score: 0.9,
          reason: null,
          experimentId: null,
          metadata: null,
        },
      });

      const result = await storage.listScores({});
      expect(result.scores).toHaveLength(2);

      const filtered = await storage.listScores({
        filters: { scorerId: 'relevance' },
      });
      expect(filtered.scores).toHaveLength(1);
      expect(filtered.scores[0]!.score).toBe(0.85);
    });

    it('gets a score by id', async () => {
      await storage.createScore({
        score: {
          scoreId: 'score-lookup-1',
          timestamp: new Date('2026-01-01T00:00:00Z'),
          traceId: 'trace-lookup-1',
          spanId: null,
          scorerId: 'relevance',
          score: 0.85,
          reason: 'Good answer',
          experimentId: 'exp-lookup',
          metadata: { entityType: 'agent' },
        },
      });
      await storage.createScore({
        score: {
          scoreId: 'score-lookup-2',
          timestamp: new Date('2026-01-01T00:01:00Z'),
          traceId: 'trace-lookup-2',
          spanId: 'span-lookup-2',
          scorerId: 'factuality',
          score: 0.9,
          reason: null,
          experimentId: null,
          metadata: null,
        },
      });

      const score = await storage.getScoreById('score-lookup-1');
      expect(score).toEqual(
        expect.objectContaining({
          scoreId: 'score-lookup-1',
          traceId: 'trace-lookup-1',
          scorerId: 'relevance',
          score: 0.85,
        }),
      );
      expect(await storage.getScoreById('missing-score')).toBeNull();
    });

    it('supports deprecated source aliases for scores', async () => {
      await storage.createScore({
        score: {
          scoreId: 'score-test-1',
          timestamp: new Date('2026-01-01T00:00:00Z'),
          traceId: 'trace-legacy-score',
          spanId: null,
          scorerId: 'legacy',
          source: 'manual',
          score: 1,
          reason: null,
          experimentId: null,
          metadata: null,
        },
      });

      const filtered = await storage.listScores({
        filters: { source: 'manual' },
      });

      expect(filtered.scores).toHaveLength(1);
      expect(filtered.scores[0]!.traceId).toBe('trace-legacy-score');
      expect(filtered.scores[0]!.source).toBe('manual');
      expect(filtered.scores[0]!.scoreSource).toBe('manual');
    });

    it('supports nullable traceId for scores at the storage boundary', async () => {
      await storage.createScore({
        score: {
          scoreId: 'score-test-1',
          timestamp: new Date('2026-01-01T00:00:00Z'),
          traceId: null,
          spanId: null,
          scorerId: 'quality',
          scoreSource: 'automated',
          score: 0.9,
          reason: null,
          experimentId: null,
          metadata: null,
        } as any,
      });

      const result = await storage.listScores({});
      expect(result.scores).toHaveLength(1);
      expect(result.scores[0]!.traceId).toBeNull();
      expect(result.scores[0]!.scoreSource).toBe('automated');
    });

    it('supports score OLAP queries keyed by scorerId and optional scoreSource', async () => {
      await storage.batchCreateScores({
        scores: [
          {
            scoreId: 'score-test-1',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            traceId: 'score-olap-1',
            scorerId: 'relevance',
            scoreSource: 'manual',
            score: 0.8,
            experimentId: 'exp-1',
            entityName: 'agent-a',
          },
          {
            scoreId: 'score-test-2',
            timestamp: new Date('2026-01-01T00:20:00Z'),
            traceId: 'score-olap-2',
            scorerId: 'relevance',
            scoreSource: 'manual',
            score: 0.6,
            experimentId: 'exp-2',
            entityName: 'agent-b',
          },
          {
            scoreId: 'score-test-3',
            timestamp: new Date('2026-01-01T00:40:00Z'),
            traceId: 'score-olap-3',
            scorerId: 'relevance',
            scoreSource: 'automated',
            score: 0.2,
            experimentId: 'exp-3',
            entityName: 'agent-c',
          },
        ],
      });

      expect(
        await storage.getScoreAggregate({
          scorerId: 'relevance',
          scoreSource: 'manual',
          aggregation: 'avg',
        }),
      ).toEqual({ value: 0.7 });

      expect(
        await storage.getScoreBreakdown({
          scorerId: 'relevance',
          scoreSource: 'manual',
          aggregation: 'avg',
          groupBy: ['experimentId'],
        }),
      ).toEqual({
        groups: [
          { dimensions: { experimentId: 'exp-1' }, value: 0.8 },
          { dimensions: { experimentId: 'exp-2' }, value: 0.6 },
        ],
      });

      expect(
        await storage.getScoreTimeSeries({
          scorerId: 'relevance',
          scoreSource: 'manual',
          aggregation: 'avg',
          interval: '1h',
        }),
      ).toEqual({
        series: [
          {
            name: 'relevance|manual',
            points: [{ timestamp: new Date('2026-01-01T00:00:00Z'), value: 0.7 }],
          },
        ],
      });

      expect(
        await storage.getScorePercentiles({
          scorerId: 'relevance',
          scoreSource: 'manual',
          percentiles: [0.5],
          interval: '1h',
        }),
      ).toEqual({
        series: [
          {
            percentile: 0.5,
            points: [{ timestamp: new Date('2026-01-01T00:00:00Z'), value: 0.7 }],
          },
        ],
      });
    });
  });

  // ==========================================================================
  // Feedback
  // ==========================================================================

  describe('feedback', () => {
    it('creates and lists feedback', async () => {
      await storage.createFeedback({
        feedback: {
          feedbackId: 'feedback-test-1',
          timestamp: new Date(),
          traceId: 'trace-1',
          spanId: null,
          feedbackSource: 'user',
          feedbackType: 'thumbs',
          value: 1,
          comment: 'Great!',
          experimentId: null,
          feedbackUserId: 'user-1',
          sourceId: 'source-1',
          metadata: null,
        },
      });

      await storage.createFeedback({
        feedback: {
          feedbackId: 'feedback-test-2',
          timestamp: new Date(),
          traceId: 'trace-2',
          spanId: null,
          feedbackSource: 'reviewer',
          feedbackType: 'rating',
          value: 4,
          comment: null,
          experimentId: 'exp-1',
          feedbackUserId: 'user-2',
          sourceId: 'source-2',
          metadata: null,
        },
      });

      const result = await storage.listFeedback({});
      expect(result.feedback).toHaveLength(2);

      const filtered = await storage.listFeedback({
        filters: { feedbackSource: 'user' },
      });
      expect(filtered.feedback).toHaveLength(1);
      expect(filtered.feedback[0]!.value).toBe(1);
      expect(filtered.feedback[0]!.feedbackUserId).toBe('user-1');
      expect(filtered.feedback[0]!.sourceId).toBe('source-1');
    });

    it('supports deprecated source aliases for feedback', async () => {
      await storage.createFeedback({
        feedback: {
          feedbackId: 'feedback-test-1',
          timestamp: new Date('2026-01-01T00:00:00Z'),
          traceId: 'trace-legacy-feedback',
          spanId: null,
          source: 'manual',
          feedbackType: 'rating',
          value: 5,
          comment: null,
          experimentId: null,
          sourceId: null,
          metadata: null,
        },
      });

      const filtered = await storage.listFeedback({
        filters: { source: 'manual' },
      });

      expect(filtered.feedback).toHaveLength(1);
      expect(filtered.feedback[0]!.traceId).toBe('trace-legacy-feedback');
      expect(filtered.feedback[0]!.source).toBe('manual');
      expect(filtered.feedback[0]!.feedbackSource).toBe('manual');
    });

    it('supports nullable traceId for feedback at the storage boundary', async () => {
      await storage.createFeedback({
        feedback: {
          feedbackId: 'feedback-test-1',
          timestamp: new Date('2026-01-01T00:00:00Z'),
          traceId: null,
          spanId: null,
          feedbackSource: 'manual',
          feedbackType: 'rating',
          value: 5,
          comment: null,
          experimentId: null,
          sourceId: null,
          metadata: null,
        } as any,
      });

      const result = await storage.listFeedback({});
      expect(result.feedback).toHaveLength(1);
      expect(result.feedback[0]!.traceId).toBeNull();
      expect(result.feedback[0]!.feedbackSource).toBe('manual');
    });

    it('batch creates and lists feedback', async () => {
      await storage.batchCreateFeedback({
        feedbacks: [
          {
            feedbackId: 'feedback-test-1',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            traceId: 'batch-trace-1',
            spanId: null,
            feedbackSource: 'user',
            feedbackType: 'thumbs',
            value: 1,
            comment: 'Helpful',
            experimentId: null,
            feedbackUserId: 'user-1',
            sourceId: 'source-1',
            metadata: null,
          },
          {
            feedbackId: 'feedback-test-2',
            timestamp: new Date('2026-01-01T00:00:01Z'),
            traceId: 'batch-trace-2',
            spanId: 'span-2',
            feedbackSource: 'reviewer',
            feedbackType: 'rating',
            value: 4,
            comment: null,
            experimentId: 'exp-1',
            feedbackUserId: 'user-2',
            sourceId: 'source-2',
            metadata: { category: 'quality' },
          },
          {
            feedbackId: 'feedback-test-3',
            timestamp: new Date('2026-01-01T00:00:02Z'),
            traceId: 'batch-trace-3',
            spanId: null,
            feedbackSource: 'system',
            feedbackType: 'flag',
            value: 'needs-review',
            comment: 'Escalated',
            experimentId: null,
            feedbackUserId: null,
            sourceId: 'source-3',
            metadata: { severity: 'high' },
          },
        ],
      });

      const result = await storage.listFeedback({
        orderBy: { field: 'timestamp', direction: 'ASC' },
      });

      expect(result.feedback).toHaveLength(3);
      expect(result.feedback).toEqual([
        expect.objectContaining({
          traceId: 'batch-trace-1',
          spanId: null,
          feedbackSource: 'user',
          feedbackType: 'thumbs',
          value: 1,
          comment: 'Helpful',
          metadata: null,
        }),
        expect.objectContaining({
          traceId: 'batch-trace-2',
          spanId: 'span-2',
          feedbackSource: 'reviewer',
          feedbackType: 'rating',
          value: 4,
          comment: null,
          metadata: { category: 'quality' },
        }),
        expect.objectContaining({
          traceId: 'batch-trace-3',
          spanId: null,
          feedbackSource: 'system',
          feedbackType: 'flag',
          value: 'needs-review',
          comment: 'Escalated',
          metadata: { severity: 'high' },
        }),
      ]);
    });

    it('supports feedback OLAP queries keyed by feedbackType and optional feedbackSource', async () => {
      await storage.batchCreateFeedback({
        feedbacks: [
          {
            feedbackId: 'feedback-test-1',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            traceId: 'feedback-olap-1',
            feedbackType: 'rating',
            feedbackSource: 'user',
            value: 5,
            entityName: 'agent-a',
          },
          {
            feedbackId: 'feedback-test-2',
            timestamp: new Date('2026-01-01T00:10:00Z'),
            traceId: 'feedback-olap-2',
            feedbackType: 'rating',
            feedbackSource: 'user',
            value: '4',
            entityName: 'agent-b',
          },
          {
            feedbackId: 'feedback-test-3',
            timestamp: new Date('2026-01-01T00:20:00Z'),
            traceId: 'feedback-olap-3',
            feedbackType: 'rating',
            feedbackSource: 'system',
            value: 1,
            entityName: 'agent-a',
          },
          {
            feedbackId: 'feedback-test-4',
            timestamp: new Date('2026-01-01T00:30:00Z'),
            traceId: 'feedback-olap-4',
            feedbackType: 'rating',
            feedbackSource: 'user',
            value: 'needs-review',
            entityName: 'agent-a',
          },
        ],
      });

      expect(
        await storage.getFeedbackAggregate({
          feedbackType: 'rating',
          feedbackSource: 'user',
          aggregation: 'avg',
        }),
      ).toEqual({ value: 4.5 });

      expect(
        await storage.getFeedbackBreakdown({
          feedbackType: 'rating',
          feedbackSource: 'user',
          aggregation: 'avg',
          groupBy: ['entityName'],
        }),
      ).toEqual({
        groups: [
          { dimensions: { entityName: 'agent-a' }, value: 5 },
          { dimensions: { entityName: 'agent-b' }, value: 4 },
        ],
      });

      expect(
        await storage.getFeedbackTimeSeries({
          feedbackType: 'rating',
          feedbackSource: 'user',
          aggregation: 'avg',
          interval: '1h',
        }),
      ).toEqual({
        series: [
          {
            name: 'rating|user',
            points: [{ timestamp: new Date('2026-01-01T00:00:00Z'), value: 4.5 }],
          },
        ],
      });

      expect(
        await storage.getFeedbackPercentiles({
          feedbackType: 'rating',
          feedbackSource: 'user',
          percentiles: [0.5],
          interval: '1h',
        }),
      ).toEqual({
        series: [
          {
            percentile: 0.5,
            points: [{ timestamp: new Date('2026-01-01T00:00:00Z'), value: 4.5 }],
          },
        ],
      });
    });
  });

  // ==========================================================================
  // Idempotent retries (signal-id primary keys)
  // ==========================================================================

  describe('retry idempotency', () => {
    it('re-inserting the same logId does not throw or duplicate', async () => {
      const log = {
        logId: 'log-retry-1',
        timestamp: new Date('2026-01-01T00:00:00Z'),
        level: 'info',
        message: 'retry-test',
        data: null,
        traceId: 'trace-1',
        spanId: 'span-1',
        tags: null,
        metadata: null,
      };
      await storage.batchCreateLogs({ logs: [log] });
      await storage.batchCreateLogs({ logs: [log] });
      const result = await storage.listLogs({ filters: { traceId: 'trace-1' } });
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]!.logId).toBe('log-retry-1');
    });

    it('re-inserting the same metricId does not throw or duplicate', async () => {
      const metric = {
        metricId: 'metric-retry-1',
        timestamp: new Date('2026-01-01T00:00:00Z'),
        name: 'mastra_agent_duration_ms',
        value: 100,
        labels: null,
        tags: null,
      };
      await storage.batchCreateMetrics({ metrics: [metric] });
      await storage.batchCreateMetrics({ metrics: [metric] });
      const result = await storage.listMetrics({ filters: { name: 'mastra_agent_duration_ms' } });
      expect(result.metrics).toHaveLength(1);
      expect(result.metrics[0]!.metricId).toBe('metric-retry-1');
    });

    it('re-inserting the same scoreId does not throw or duplicate', async () => {
      const score = {
        scoreId: 'score-retry-1',
        timestamp: new Date('2026-01-01T00:00:00Z'),
        traceId: 'trace-retry-score',
        spanId: null,
        scorerId: 'scorer-1',
        score: 0.9,
        reason: null,
        experimentId: null,
        metadata: null,
      };
      await storage.createScore({ score });
      await storage.createScore({ score });
      const result = await storage.listScores({ filters: { traceId: 'trace-retry-score' } });
      expect(result.scores).toHaveLength(1);
      expect(result.scores[0]!.scoreId).toBe('score-retry-1');
    });

    it('re-inserting the same feedbackId does not throw or duplicate', async () => {
      const feedback = {
        feedbackId: 'feedback-retry-1',
        timestamp: new Date('2026-01-01T00:00:00Z'),
        traceId: 'trace-retry-feedback',
        spanId: null,
        feedbackType: 'rating',
        feedbackSource: 'user',
        value: 5,
        comment: null,
        experimentId: null,
        feedbackUserId: null,
        sourceId: null,
        metadata: null,
      };
      await storage.createFeedback({ feedback });
      await storage.createFeedback({ feedback });
      const result = await storage.listFeedback({ filters: { traceId: 'trace-retry-feedback' } });
      expect(result.feedback).toHaveLength(1);
      expect(result.feedback[0]!.feedbackId).toBe('feedback-retry-1');
    });
  });
});
