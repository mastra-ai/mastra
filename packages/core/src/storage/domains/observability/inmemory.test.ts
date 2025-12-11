import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { SpanType, EntityType } from '../../../observability';
import { StoreOperationsInMemory } from '../operations/inmemory';
import type { CreateSpanRecord } from './base';
import { ObservabilityInMemory } from './inmemory';
import type { InMemoryObservability } from './inmemory';
import { TraceStatus } from './types';

describe('ObservabilityInMemory', () => {
  let storage: ObservabilityInMemory;
  let collection: InMemoryObservability;
  let operations: StoreOperationsInMemory;
  let baseDate: Date;

  beforeEach(() => {
    baseDate = new Date('2024-01-01T00:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(baseDate);

    collection = new Map();
    operations = new StoreOperationsInMemory();
    storage = new ObservabilityInMemory({ collection, operations });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const createSpan = (overrides: Partial<CreateSpanRecord> = {}): CreateSpanRecord => ({
    traceId: 'trace-1',
    spanId: 'span-1',
    parentSpanId: null,
    span: 'Test Span',
    spanType: SpanType.AGENT_RUN,
    entityType: EntityType.AGENT,
    entityId: 'agent-1',
    entityName: 'Test Agent',
    userId: null,
    organizationId: null,
    resourceId: null,
    runId: null,
    sessionId: null,
    threadId: null,
    requestId: null,
    environment: 'test',
    source: 'local',
    serviceName: 'test-service',
    scope: null,
    attributes: null,
    metadata: null,
    tags: null,
    links: null,
    input: null,
    output: null,
    error: null,
    isEvent: false,
    startedAt: baseDate,
    endedAt: new Date(baseDate.getTime() + 1000),
    ...overrides,
  });

  describe('createSpan', () => {
    it('should create a span with timestamps', async () => {
      const span = createSpan();
      await storage.createSpan(span);

      const trace = await storage.getTrace('trace-1');
      expect(trace).not.toBeNull();
      expect(trace!.spans.length).toBe(1);
      expect(trace!.spans[0]!.createdAt).toEqual(baseDate);
      expect(trace!.spans[0]!.updatedAt).toEqual(baseDate);
    });

    it('should throw error when spanId is missing', async () => {
      const span = createSpan({ spanId: '' });
      await expect(storage.createSpan(span)).rejects.toThrow('Span ID is required');
    });

    it('should throw error when traceId is missing', async () => {
      const span = createSpan({ traceId: '' });
      await expect(storage.createSpan(span)).rejects.toThrow('Trace ID is required');
    });

    it('should track root span correctly', async () => {
      const rootSpan = createSpan({ spanId: 'root', parentSpanId: null });
      const childSpan = createSpan({ spanId: 'child', parentSpanId: 'root' });

      await storage.createSpan(rootSpan);
      await storage.createSpan(childSpan);

      const trace = await storage.getTrace('trace-1');
      expect(trace!.spans.length).toBe(2);
    });
  });

  describe('batchCreateSpans', () => {
    it('should create multiple spans', async () => {
      const spans = [
        createSpan({ spanId: 'span-1' }),
        createSpan({ spanId: 'span-2', parentSpanId: 'span-1' }),
        createSpan({ spanId: 'span-3', parentSpanId: 'span-1' }),
      ];

      await storage.batchCreateSpans({ records: spans });

      const trace = await storage.getTrace('trace-1');
      expect(trace!.spans.length).toBe(3);
    });

    it('should create spans across multiple traces', async () => {
      const spans = [
        createSpan({ traceId: 'trace-1', spanId: 'span-1' }),
        createSpan({ traceId: 'trace-2', spanId: 'span-2' }),
      ];

      await storage.batchCreateSpans({ records: spans });

      const trace1 = await storage.getTrace('trace-1');
      const trace2 = await storage.getTrace('trace-2');
      expect(trace1!.spans.length).toBe(1);
      expect(trace2!.spans.length).toBe(1);
    });
  });

  describe('getTrace', () => {
    it('should return null for non-existent trace', async () => {
      const trace = await storage.getTrace('non-existent');
      expect(trace).toBeNull();
    });

    it('should return trace with all spans sorted by startedAt', async () => {
      const span1 = createSpan({
        spanId: 'span-1',
        startedAt: new Date(baseDate.getTime() + 2000),
      });
      const span2 = createSpan({
        spanId: 'span-2',
        parentSpanId: 'span-1',
        startedAt: new Date(baseDate.getTime() + 1000),
      });
      const span3 = createSpan({
        spanId: 'span-3',
        parentSpanId: 'span-1',
        startedAt: baseDate,
      });

      await storage.batchCreateSpans({ records: [span1, span2, span3] });

      const trace = await storage.getTrace('trace-1');
      expect(trace!.traceId).toBe('trace-1');
      expect(trace!.spans[0]!.spanId).toBe('span-3');
      expect(trace!.spans[1]!.spanId).toBe('span-2');
      expect(trace!.spans[2]!.spanId).toBe('span-1');
    });
  });

  describe('updateSpan', () => {
    it('should throw error when trace not found', async () => {
      await expect(
        storage.updateSpan({
          traceId: 'non-existent',
          spanId: 'span-1',
          updates: { output: 'result' },
        }),
      ).rejects.toThrow('Trace not found');
    });

    it('should throw error when span not found', async () => {
      await storage.createSpan(createSpan());

      await expect(
        storage.updateSpan({
          traceId: 'trace-1',
          spanId: 'non-existent',
          updates: { output: 'result' },
        }),
      ).rejects.toThrow('Span not found');
    });

    it('should update span fields', async () => {
      await storage.createSpan(createSpan());

      const laterDate = new Date(baseDate.getTime() + 5000);
      vi.setSystemTime(laterDate);

      await storage.updateSpan({
        traceId: 'trace-1',
        spanId: 'span-1',
        updates: {
          output: { result: 'success' },
          endedAt: laterDate,
        },
      });

      const trace = await storage.getTrace('trace-1');
      expect(trace!.spans[0]!.output).toEqual({ result: 'success' });
      expect(trace!.spans[0]!.endedAt).toEqual(laterDate);
      expect(trace!.spans[0]!.updatedAt).toEqual(laterDate);
    });

    it('should update trace status when root span gets error', async () => {
      await storage.createSpan(createSpan({ endedAt: null }));

      await storage.updateSpan({
        traceId: 'trace-1',
        spanId: 'span-1',
        updates: { error: { message: 'Something went wrong' } },
      });

      const result = await storage.listTraces({ filters: { status: TraceStatus.ERROR } });
      expect(result.spans.length).toBe(1);
    });

    it('should update trace status when root span completes', async () => {
      await storage.createSpan(createSpan({ endedAt: null }));

      // Initially running
      let result = await storage.listTraces({ filters: { status: TraceStatus.RUNNING } });
      expect(result.spans.length).toBe(1);

      // Mark as complete
      await storage.updateSpan({
        traceId: 'trace-1',
        spanId: 'span-1',
        updates: { endedAt: new Date() },
      });

      result = await storage.listTraces({ filters: { status: TraceStatus.SUCCESS } });
      expect(result.spans.length).toBe(1);
    });
  });

  describe('batchUpdateSpans', () => {
    it('should update multiple spans', async () => {
      await storage.batchCreateSpans({
        records: [createSpan({ spanId: 'span-1' }), createSpan({ spanId: 'span-2', parentSpanId: 'span-1' })],
      });

      await storage.batchUpdateSpans({
        records: [
          { traceId: 'trace-1', spanId: 'span-1', updates: { output: 'result-1' } },
          { traceId: 'trace-1', spanId: 'span-2', updates: { output: 'result-2' } },
        ],
      });

      const trace = await storage.getTrace('trace-1');
      const span1 = trace!.spans.find(s => s.spanId === 'span-1');
      const span2 = trace!.spans.find(s => s.spanId === 'span-2');
      expect(span1!.output).toBe('result-1');
      expect(span2!.output).toBe('result-2');
    });
  });

  describe('batchDeleteTraces', () => {
    it('should delete traces', async () => {
      await storage.batchCreateSpans({
        records: [
          createSpan({ traceId: 'trace-1', spanId: 'span-1' }),
          createSpan({ traceId: 'trace-2', spanId: 'span-2' }),
          createSpan({ traceId: 'trace-3', spanId: 'span-3' }),
        ],
      });

      await storage.batchDeleteTraces({ traceIds: ['trace-1', 'trace-3'] });

      expect(await storage.getTrace('trace-1')).toBeNull();
      expect(await storage.getTrace('trace-2')).not.toBeNull();
      expect(await storage.getTrace('trace-3')).toBeNull();
    });

    it('should be idempotent for non-existent traces', async () => {
      await expect(storage.batchDeleteTraces({ traceIds: ['non-existent'] })).resolves.toBeUndefined();
    });
  });

  describe('listTraces', () => {
    const createMultipleTraces = async () => {
      const traces = [
        // Trace 1: Success, agent
        createSpan({
          traceId: 'trace-1',
          spanId: 'root-1',
          entityType: EntityType.AGENT,
          entityId: 'agent-1',
          entityName: 'Agent One',
          environment: 'production',
          userId: 'user-1',
          tags: ['important', 'customer'],
          metadata: { priority: 'high' },
          startedAt: new Date(baseDate.getTime()),
          endedAt: new Date(baseDate.getTime() + 1000),
        }),
        // Trace 2: Error, workflow
        createSpan({
          traceId: 'trace-2',
          spanId: 'root-2',
          spanType: SpanType.WORKFLOW_RUN,
          entityType: EntityType.WORKFLOW_RUN,
          entityId: 'workflow-1',
          entityName: 'Workflow One',
          environment: 'staging',
          userId: 'user-2',
          error: { message: 'Failed' },
          startedAt: new Date(baseDate.getTime() + 2000),
          endedAt: new Date(baseDate.getTime() + 3000),
        }),
        // Trace 3: Running, agent
        createSpan({
          traceId: 'trace-3',
          spanId: 'root-3',
          entityType: EntityType.AGENT,
          entityId: 'agent-2',
          entityName: 'Agent Two',
          environment: 'production',
          userId: 'user-1',
          tags: ['important'],
          startedAt: new Date(baseDate.getTime() + 4000),
          endedAt: null,
        }),
      ];

      for (const span of traces) {
        await storage.createSpan(span);
      }

      // Add child span with error to trace-1
      await storage.createSpan(
        createSpan({
          traceId: 'trace-1',
          spanId: 'child-1',
          parentSpanId: 'root-1',
          error: { message: 'Child error' },
          startedAt: new Date(baseDate.getTime() + 500),
          endedAt: new Date(baseDate.getTime() + 800),
        }),
      );
    };

    it('should return empty list when no traces exist', async () => {
      const result = await storage.listTraces({});

      expect(result.spans).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should return all root spans with default pagination', async () => {
      await createMultipleTraces();

      const result = await storage.listTraces({});

      expect(result.spans.length).toBe(3);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.page).toBe(0);
      expect(result.pagination.perPage).toBe(100);
    });

    it('should sort by startedAt DESC by default', async () => {
      await createMultipleTraces();

      const result = await storage.listTraces({});

      expect(result.spans[0]!.traceId).toBe('trace-3');
      expect(result.spans[1]!.traceId).toBe('trace-2');
      expect(result.spans[2]!.traceId).toBe('trace-1');
    });

    it('should sort by startedAt ASC', async () => {
      await createMultipleTraces();

      const result = await storage.listTraces({
        orderBy: { field: 'startedAt', direction: 'ASC' },
      });

      expect(result.spans[0]!.traceId).toBe('trace-1');
      expect(result.spans[1]!.traceId).toBe('trace-2');
      expect(result.spans[2]!.traceId).toBe('trace-3');
    });

    it('should sort by endedAt DESC with nulls at end', async () => {
      await createMultipleTraces();

      const result = await storage.listTraces({
        orderBy: { field: 'endedAt', direction: 'DESC' },
      });

      // Running trace (null endedAt) should be last
      expect(result.spans[0]!.traceId).toBe('trace-2');
      expect(result.spans[1]!.traceId).toBe('trace-1');
      expect(result.spans[2]!.traceId).toBe('trace-3');
    });

    it('should paginate results', async () => {
      await createMultipleTraces();

      const page1 = await storage.listTraces({ pagination: { page: 0, perPage: 2 } });
      expect(page1.spans.length).toBe(2);
      expect(page1.pagination.hasMore).toBe(true);

      const page2 = await storage.listTraces({ pagination: { page: 1, perPage: 2 } });
      expect(page2.spans.length).toBe(1);
      expect(page2.pagination.hasMore).toBe(false);
    });

    describe('filters', () => {
      beforeEach(async () => {
        await createMultipleTraces();
      });

      it('should filter by status SUCCESS', async () => {
        const result = await storage.listTraces({ filters: { status: TraceStatus.SUCCESS } });
        expect(result.spans.length).toBe(1);
        expect(result.spans[0]!.traceId).toBe('trace-1');
      });

      it('should filter by status ERROR', async () => {
        const result = await storage.listTraces({ filters: { status: TraceStatus.ERROR } });
        expect(result.spans.length).toBe(1);
        expect(result.spans[0]!.traceId).toBe('trace-2');
      });

      it('should filter by status RUNNING', async () => {
        const result = await storage.listTraces({ filters: { status: TraceStatus.RUNNING } });
        expect(result.spans.length).toBe(1);
        expect(result.spans[0]!.traceId).toBe('trace-3');
      });

      it('should filter by hasChildError', async () => {
        const result = await storage.listTraces({ filters: { hasChildError: true } });
        expect(result.spans.length).toBe(2); // trace-1 has child error, trace-2 has root error
      });

      it('should filter by entityType', async () => {
        const result = await storage.listTraces({ filters: { entityType: EntityType.WORKFLOW_RUN } });
        expect(result.spans.length).toBe(1);
        expect(result.spans[0]!.traceId).toBe('trace-2');
      });

      it('should filter by entityId', async () => {
        const result = await storage.listTraces({ filters: { entityId: 'agent-1' } });
        expect(result.spans.length).toBe(1);
        expect(result.spans[0]!.traceId).toBe('trace-1');
      });

      it('should filter by entityName', async () => {
        const result = await storage.listTraces({ filters: { entityName: 'Workflow One' } });
        expect(result.spans.length).toBe(1);
        expect(result.spans[0]!.traceId).toBe('trace-2');
      });

      it('should filter by spanType', async () => {
        const result = await storage.listTraces({ filters: { spanType: SpanType.WORKFLOW_RUN } });
        expect(result.spans.length).toBe(1);
        expect(result.spans[0]!.traceId).toBe('trace-2');
      });

      it('should filter by userId', async () => {
        const result = await storage.listTraces({ filters: { userId: 'user-1' } });
        expect(result.spans.length).toBe(2);
      });

      it('should filter by environment', async () => {
        const result = await storage.listTraces({ filters: { environment: 'production' } });
        expect(result.spans.length).toBe(2);
      });

      it('should filter by tags (all must match)', async () => {
        const result = await storage.listTraces({ filters: { tags: ['important', 'customer'] } });
        expect(result.spans.length).toBe(1);
        expect(result.spans[0]!.traceId).toBe('trace-1');
      });

      it('should filter by partial tags', async () => {
        const result = await storage.listTraces({ filters: { tags: ['important'] } });
        expect(result.spans.length).toBe(2);
      });

      it('should filter by metadata (partial match)', async () => {
        const result = await storage.listTraces({ filters: { metadata: { priority: 'high' } } });
        expect(result.spans.length).toBe(1);
        expect(result.spans[0]!.traceId).toBe('trace-1');
      });

      it('should filter by startedAt date range', async () => {
        const result = await storage.listTraces({
          filters: {
            startedAt: {
              start: new Date(baseDate.getTime() + 1000),
              end: new Date(baseDate.getTime() + 3000),
            },
          },
        });
        expect(result.spans.length).toBe(1);
        expect(result.spans[0]!.traceId).toBe('trace-2');
      });

      it('should filter by endedAt date range', async () => {
        const result = await storage.listTraces({
          filters: {
            endedAt: {
              start: new Date(baseDate.getTime()),
              end: new Date(baseDate.getTime() + 2000),
            },
          },
        });
        expect(result.spans.length).toBe(1);
        expect(result.spans[0]!.traceId).toBe('trace-1');
      });

      it('should exclude running traces when filtering by endedAt', async () => {
        const result = await storage.listTraces({
          filters: {
            endedAt: {
              start: new Date(0),
            },
          },
        });
        // Should not include trace-3 which has null endedAt
        expect(result.spans.every(s => s.traceId !== 'trace-3')).toBe(true);
      });

      it('should combine multiple filters', async () => {
        const result = await storage.listTraces({
          filters: {
            entityType: EntityType.AGENT,
            environment: 'production',
            status: TraceStatus.SUCCESS,
          },
        });
        expect(result.spans.length).toBe(1);
        expect(result.spans[0]!.traceId).toBe('trace-1');
      });
    });
  });

  describe('tracingStrategy', () => {
    it('should prefer realtime strategy', () => {
      expect(storage.tracingStrategy.preferred).toBe('realtime');
    });

    it('should support all strategies', () => {
      expect(storage.tracingStrategy.supported).toContain('realtime');
      expect(storage.tracingStrategy.supported).toContain('batch-with-updates');
      expect(storage.tracingStrategy.supported).toContain('insert-only');
    });
  });

  describe('hasChildError computation', () => {
    it('should set hasChildError when any child span has error', async () => {
      await storage.createSpan(createSpan({ traceId: 'trace-1', spanId: 'root' }));
      await storage.createSpan(
        createSpan({
          traceId: 'trace-1',
          spanId: 'child',
          parentSpanId: 'root',
          error: { message: 'Error' },
        }),
      );

      const result = await storage.listTraces({ filters: { hasChildError: true } });
      expect(result.spans.length).toBe(1);
    });

    it('should update hasChildError when child span error is added via update', async () => {
      await storage.createSpan(createSpan({ traceId: 'trace-1', spanId: 'root' }));
      await storage.createSpan(
        createSpan({
          traceId: 'trace-1',
          spanId: 'child',
          parentSpanId: 'root',
        }),
      );

      // Initially no errors
      let result = await storage.listTraces({ filters: { hasChildError: false } });
      expect(result.spans.length).toBe(1);

      // Add error to child
      await storage.updateSpan({
        traceId: 'trace-1',
        spanId: 'child',
        updates: { error: { message: 'Error' } },
      });

      result = await storage.listTraces({ filters: { hasChildError: true } });
      expect(result.spans.length).toBe(1);
    });
  });

  describe('correlation ID filters', () => {
    beforeEach(async () => {
      await storage.createSpan(
        createSpan({
          traceId: 'trace-1',
          spanId: 'span-1',
          runId: 'run-123',
          sessionId: 'session-abc',
          threadId: 'thread-xyz',
          requestId: 'req-001',
        }),
      );
      await storage.createSpan(
        createSpan({
          traceId: 'trace-2',
          spanId: 'span-2',
          runId: 'run-456',
          sessionId: 'session-abc',
          threadId: null,
          requestId: null,
        }),
      );
    });

    it('should filter by runId', async () => {
      const result = await storage.listTraces({ filters: { runId: 'run-123' } });
      expect(result.spans.length).toBe(1);
      expect(result.spans[0]!.traceId).toBe('trace-1');
    });

    it('should filter by sessionId', async () => {
      const result = await storage.listTraces({ filters: { sessionId: 'session-abc' } });
      expect(result.spans.length).toBe(2);
    });

    it('should filter by threadId', async () => {
      const result = await storage.listTraces({ filters: { threadId: 'thread-xyz' } });
      expect(result.spans.length).toBe(1);
      expect(result.spans[0]!.traceId).toBe('trace-1');
    });

    it('should filter by requestId', async () => {
      const result = await storage.listTraces({ filters: { requestId: 'req-001' } });
      expect(result.spans.length).toBe(1);
      expect(result.spans[0]!.traceId).toBe('trace-1');
    });
  });

  describe('deployment context filters', () => {
    beforeEach(async () => {
      await storage.createSpan(
        createSpan({
          traceId: 'trace-1',
          spanId: 'span-1',
          environment: 'production',
          source: 'cloud',
          serviceName: 'api-service',
          scope: { version: '1.0.0', gitSha: 'abc123' },
        }),
      );
      await storage.createSpan(
        createSpan({
          traceId: 'trace-2',
          spanId: 'span-2',
          environment: 'staging',
          source: 'local',
          serviceName: 'api-service',
          scope: { version: '1.1.0' },
        }),
      );
    });

    it('should filter by source', async () => {
      const result = await storage.listTraces({ filters: { source: 'cloud' } });
      expect(result.spans.length).toBe(1);
      expect(result.spans[0]!.traceId).toBe('trace-1');
    });

    it('should filter by serviceName', async () => {
      const result = await storage.listTraces({ filters: { serviceName: 'api-service' } });
      expect(result.spans.length).toBe(2);
    });

    it('should filter by scope (partial match)', async () => {
      const result = await storage.listTraces({ filters: { scope: { version: '1.0.0' } } });
      expect(result.spans.length).toBe(1);
      expect(result.spans[0]!.traceId).toBe('trace-1');
    });
  });

  describe('identity filters', () => {
    beforeEach(async () => {
      await storage.createSpan(
        createSpan({
          traceId: 'trace-1',
          spanId: 'span-1',
          userId: 'user-1',
          organizationId: 'org-a',
          resourceId: 'resource-x',
        }),
      );
      await storage.createSpan(
        createSpan({
          traceId: 'trace-2',
          spanId: 'span-2',
          userId: 'user-2',
          organizationId: 'org-a',
          resourceId: 'resource-y',
        }),
      );
    });

    it('should filter by organizationId', async () => {
      const result = await storage.listTraces({ filters: { organizationId: 'org-a' } });
      expect(result.spans.length).toBe(2);
    });

    it('should filter by resourceId', async () => {
      const result = await storage.listTraces({ filters: { resourceId: 'resource-x' } });
      expect(result.spans.length).toBe(1);
      expect(result.spans[0]!.traceId).toBe('trace-1');
    });
  });
});
