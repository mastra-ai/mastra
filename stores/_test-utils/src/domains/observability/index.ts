import { MastraStorage, TraceStatus } from '@mastra/core/storage';
import type { ObservabilityStorage, SpanRecord } from '@mastra/core/storage';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSpan, createChildSpan, SpanType, EntityType, DEFAULT_BASE_DATE } from './data';

export function createObservabilityTests({ storage }: { storage: MastraStorage }) {
  let observabilityStorage: ObservabilityStorage;

  beforeAll(async () => {
    const store = await storage.getStore('observability');
    if (!store) {
      throw new Error('Observability storage not found');
    }
    observabilityStorage = store;
  });

  describe('Observability Storage', () => {
    beforeEach(async () => {
      await observabilityStorage.dangerouslyClearAll();
    });

    describe('createSpan', () => {
      it('should create a span and make it retrievable', async () => {
        const span = createSpan({ traceId: 'trace-1', spanId: 'span-1' });
        await observabilityStorage.createSpan({ span });

        const trace = await observabilityStorage.getTrace({ traceId: 'trace-1' });
        expect(trace).not.toBeNull();
        expect(trace!.spans.length).toBe(1);
        expect(trace!.spans[0]!.spanId).toBe('span-1');
      });

      it('should set createdAt and updatedAt timestamps', async () => {
        const span = createSpan({ traceId: 'trace-1', spanId: 'span-1' });
        await observabilityStorage.createSpan({ span });

        const trace = await observabilityStorage.getTrace({ traceId: 'trace-1' });
        expect(trace!.spans[0]!.createdAt).toBeDefined();
        expect(trace!.spans[0]!.updatedAt).toBeDefined();
      });

      it('should preserve all span properties', async () => {
        const span = createSpan({
          traceId: 'trace-1',
          spanId: 'span-1',
          name: 'My Test Span',
          spanType: SpanType.WORKFLOW_RUN,
          entityType: EntityType.WORKFLOW_RUN,
          entityId: 'workflow-1',
          entityName: 'Test Workflow',
          userId: 'user-123',
          environment: 'production',
          input: { message: 'hello' },
          output: { result: 'success' },
          attributes: { key: 'value' },
          metadata: { custom: 'data' },
        });
        await observabilityStorage.createSpan({ span });

        const trace = await observabilityStorage.getTrace({ traceId: 'trace-1' });
        const retrieved = trace!.spans[0]!;

        expect(retrieved.name).toBe('My Test Span');
        expect(retrieved.spanType).toBe(SpanType.WORKFLOW_RUN);
        expect(retrieved.entityType).toBe(EntityType.WORKFLOW_RUN);
        expect(retrieved.entityId).toBe('workflow-1');
        expect(retrieved.entityName).toBe('Test Workflow');
        expect(retrieved.userId).toBe('user-123');
        expect(retrieved.environment).toBe('production');
        expect(retrieved.input).toEqual({ message: 'hello' });
        expect(retrieved.output).toEqual({ result: 'success' });
        expect(retrieved.attributes).toEqual({ key: 'value' });
        expect(retrieved.metadata).toEqual({ custom: 'data' });
      });

      it('should handle parent-child span hierarchy', async () => {
        const rootSpan = createSpan({ traceId: 'trace-1', spanId: 'root' });
        const childSpan = createChildSpan('root', { traceId: 'trace-1', spanId: 'child' });

        await observabilityStorage.createSpan({ span: rootSpan });
        await observabilityStorage.createSpan({ span: childSpan });

        const trace = await observabilityStorage.getTrace({ traceId: 'trace-1' });
        expect(trace!.spans.length).toBe(2);

        const root = trace!.spans.find(s => s.spanId === 'root');
        const child = trace!.spans.find(s => s.spanId === 'child');
        expect(root!.parentSpanId).toBeNull();
        expect(child!.parentSpanId).toBe('root');
      });

      it('should handle primitive values in JSONB fields', async () => {
        const span = createSpan({
          traceId: 'trace-1',
          spanId: 'span-1',
          input: 'plain string input' as any,
          output: 'plain string output' as any,
          attributes: { temperature: 0.7, maxTokens: 100 },
          metadata: { isTest: true, retryCount: 3 },
        });

        await observabilityStorage.createSpan({ span });

        const trace = await observabilityStorage.getTrace({ traceId: 'trace-1' });
        const retrieved = trace!.spans[0]!;

        expect(retrieved.input).toBe('plain string input');
        expect(retrieved.output).toBe('plain string output');
        expect(retrieved.attributes).toEqual({ temperature: 0.7, maxTokens: 100 });
        expect(retrieved.metadata).toEqual({ isTest: true, retryCount: 3 });
      });
    });

    describe('batchCreateSpans', () => {
      it('should create multiple spans in batch', async () => {
        const spans = [
          createSpan({ traceId: 'trace-1', spanId: 'span-1' }),
          createSpan({ traceId: 'trace-1', spanId: 'span-2', parentSpanId: 'span-1' }),
          createSpan({ traceId: 'trace-1', spanId: 'span-3', parentSpanId: 'span-1' }),
        ];

        await observabilityStorage.batchCreateSpans({ records: spans });

        const trace = await observabilityStorage.getTrace({ traceId: 'trace-1' });
        expect(trace!.spans.length).toBe(3);
      });

      it('should create spans across multiple traces', async () => {
        const spans = [
          createSpan({ traceId: 'trace-1', spanId: 'span-1' }),
          createSpan({ traceId: 'trace-2', spanId: 'span-2' }),
          createSpan({ traceId: 'trace-3', spanId: 'span-3' }),
        ];

        await observabilityStorage.batchCreateSpans({ records: spans });

        const trace1 = await observabilityStorage.getTrace({ traceId: 'trace-1' });
        const trace2 = await observabilityStorage.getTrace({ traceId: 'trace-2' });
        const trace3 = await observabilityStorage.getTrace({ traceId: 'trace-3' });

        expect(trace1!.spans.length).toBe(1);
        expect(trace2!.spans.length).toBe(1);
        expect(trace3!.spans.length).toBe(1);
      });

      it('should handle empty batch gracefully', async () => {
        await expect(observabilityStorage.batchCreateSpans({ records: [] })).resolves.not.toThrow();
      });
    });

    describe('getTrace', () => {
      it('should return null for non-existent trace', async () => {
        const trace = await observabilityStorage.getTrace({ traceId: 'non-existent' });
        expect(trace).toBeNull();
      });

      it('should return trace with all associated spans', async () => {
        const rootSpan = createSpan({ traceId: 'trace-1', spanId: 'root' });
        const child1 = createChildSpan('root', { traceId: 'trace-1', spanId: 'child-1' });
        const child2 = createChildSpan('root', { traceId: 'trace-1', spanId: 'child-2' });

        await observabilityStorage.batchCreateSpans({ records: [rootSpan, child1, child2] });

        const trace = await observabilityStorage.getTrace({ traceId: 'trace-1' });
        expect(trace!.traceId).toBe('trace-1');
        expect(trace!.spans.length).toBe(3);
      });
    });

    describe('getSpan', () => {
      it('should return null for non-existent span', async () => {
        const result = await observabilityStorage.getSpan({ traceId: 'non-existent', spanId: 'non-existent' });
        expect(result).toBeNull();
      });

      it('should return null when trace exists but span does not', async () => {
        const span = createSpan({ traceId: 'trace-1', spanId: 'span-1' });
        await observabilityStorage.createSpan({ span });

        const result = await observabilityStorage.getSpan({ traceId: 'trace-1', spanId: 'non-existent' });
        expect(result).toBeNull();
      });

      it('should return the specific span by traceId and spanId', async () => {
        const rootSpan = createSpan({ traceId: 'trace-1', spanId: 'root', name: 'Root Span' });
        const childSpan = createChildSpan('root', { traceId: 'trace-1', spanId: 'child', name: 'Child Span' });

        await observabilityStorage.batchCreateSpans({ records: [rootSpan, childSpan] });

        const result = await observabilityStorage.getSpan({ traceId: 'trace-1', spanId: 'child' });
        expect(result).not.toBeNull();
        expect(result!.span.spanId).toBe('child');
        expect(result!.span.name).toBe('Child Span');
        expect(result!.span.parentSpanId).toBe('root');
      });

      it('should return span with all properties preserved', async () => {
        const span = createSpan({
          traceId: 'trace-1',
          spanId: 'span-1',
          name: 'Test Span',
          spanType: SpanType.AGENT_RUN,
          entityType: EntityType.AGENT,
          entityId: 'agent-1',
          userId: 'user-123',
          input: { message: 'hello' },
          output: { result: 'success' },
          metadata: { custom: 'data' },
        });
        await observabilityStorage.createSpan({ span });

        const result = await observabilityStorage.getSpan({ traceId: 'trace-1', spanId: 'span-1' });
        expect(result).not.toBeNull();
        expect(result!.span.name).toBe('Test Span');
        expect(result!.span.spanType).toBe(SpanType.AGENT_RUN);
        expect(result!.span.entityType).toBe(EntityType.AGENT);
        expect(result!.span.entityId).toBe('agent-1');
        expect(result!.span.userId).toBe('user-123');
        expect(result!.span.input).toEqual({ message: 'hello' });
        expect(result!.span.output).toEqual({ result: 'success' });
        expect(result!.span.metadata).toEqual({ custom: 'data' });
      });
    });

    describe('getRootSpan', () => {
      it('should return null for non-existent trace', async () => {
        const result = await observabilityStorage.getRootSpan({ traceId: 'non-existent' });
        expect(result).toBeNull();
      });

      it('should return the root span (span with null parentSpanId)', async () => {
        const rootSpan = createSpan({ traceId: 'trace-1', spanId: 'root', name: 'Root Span' });
        const childSpan = createChildSpan('root', { traceId: 'trace-1', spanId: 'child', name: 'Child Span' });

        await observabilityStorage.batchCreateSpans({ records: [rootSpan, childSpan] });

        const result = await observabilityStorage.getRootSpan({ traceId: 'trace-1' });
        expect(result).not.toBeNull();
        expect(result!.span.spanId).toBe('root');
        expect(result!.span.name).toBe('Root Span');
        expect(result!.span.parentSpanId).toBeNull();
      });

      it('should return root span with all properties preserved', async () => {
        const rootSpan = createSpan({
          traceId: 'trace-1',
          spanId: 'root',
          name: 'Root Span',
          spanType: SpanType.WORKFLOW_RUN,
          entityType: EntityType.WORKFLOW_RUN,
          entityId: 'workflow-1',
          userId: 'user-456',
          environment: 'production',
          input: { params: [1, 2, 3] },
          metadata: { version: '1.0' },
        });
        await observabilityStorage.createSpan({ span: rootSpan });

        const result = await observabilityStorage.getRootSpan({ traceId: 'trace-1' });
        expect(result).not.toBeNull();
        expect(result!.span.name).toBe('Root Span');
        expect(result!.span.spanType).toBe(SpanType.WORKFLOW_RUN);
        expect(result!.span.entityType).toBe(EntityType.WORKFLOW_RUN);
        expect(result!.span.entityId).toBe('workflow-1');
        expect(result!.span.userId).toBe('user-456');
        expect(result!.span.environment).toBe('production');
        expect(result!.span.input).toEqual({ params: [1, 2, 3] });
        expect(result!.span.metadata).toEqual({ version: '1.0' });
      });

      it('should only return root span even when trace has multiple spans', async () => {
        const rootSpan = createSpan({ traceId: 'trace-1', spanId: 'root' });
        const child1 = createChildSpan('root', { traceId: 'trace-1', spanId: 'child-1' });
        const child2 = createChildSpan('root', { traceId: 'trace-1', spanId: 'child-2' });
        const grandchild = createChildSpan('child-1', { traceId: 'trace-1', spanId: 'grandchild' });

        await observabilityStorage.batchCreateSpans({ records: [rootSpan, child1, child2, grandchild] });

        const result = await observabilityStorage.getRootSpan({ traceId: 'trace-1' });
        expect(result).not.toBeNull();
        expect(result!.span.spanId).toBe('root');
        expect(result!.span.parentSpanId).toBeNull();
      });
    });

    describe('updateSpan', () => {
      it('should update span fields', async () => {
        const span = createSpan({ traceId: 'trace-1', spanId: 'span-1' });
        await observabilityStorage.createSpan({ span });

        await observabilityStorage.updateSpan({
          traceId: 'trace-1',
          spanId: 'span-1',
          updates: {
            output: { result: 'success' },
            endedAt: new Date(DEFAULT_BASE_DATE.getTime() + 5000),
          },
        });

        const trace = await observabilityStorage.getTrace({ traceId: 'trace-1' });
        expect(trace!.spans[0]!.output).toEqual({ result: 'success' });
        expect(trace!.spans[0]!.endedAt).toEqual(new Date(DEFAULT_BASE_DATE.getTime() + 5000));
      });

      it('should update name', async () => {
        const span = createSpan({ traceId: 'trace-1', spanId: 'span-1', name: 'Original Name' });
        await observabilityStorage.createSpan({ span });

        await observabilityStorage.updateSpan({
          traceId: 'trace-1',
          spanId: 'span-1',
          updates: { name: 'Updated Name' },
        });

        const trace = await observabilityStorage.getTrace({ traceId: 'trace-1' });
        expect(trace!.spans[0]!.name).toBe('Updated Name');
      });

      it('should preserve other properties when updating', async () => {
        const span = createSpan({
          traceId: 'trace-1',
          spanId: 'span-1',
          name: 'Test Span',
          spanType: SpanType.AGENT_RUN,
          input: { original: true },
        });
        await observabilityStorage.createSpan({ span });

        await observabilityStorage.updateSpan({
          traceId: 'trace-1',
          spanId: 'span-1',
          updates: { output: { result: 'done' } },
        });

        const trace = await observabilityStorage.getTrace({ traceId: 'trace-1' });
        const updated = trace!.spans[0]!;
        expect(updated.name).toBe('Test Span');
        expect(updated.spanType).toBe(SpanType.AGENT_RUN);
        expect(updated.input).toEqual({ original: true });
        expect(updated.output).toEqual({ result: 'done' });
      });
    });

    describe('batchUpdateSpans', () => {
      it('should update multiple spans in batch', async () => {
        await observabilityStorage.batchCreateSpans({
          records: [
            createSpan({ traceId: 'trace-1', spanId: 'span-1' }),
            createSpan({ traceId: 'trace-1', spanId: 'span-2', parentSpanId: 'span-1' }),
          ],
        });

        await observabilityStorage.batchUpdateSpans({
          records: [
            { traceId: 'trace-1', spanId: 'span-1', updates: { output: 'result-1' } },
            { traceId: 'trace-1', spanId: 'span-2', updates: { output: 'result-2' } },
          ],
        });

        const trace = await observabilityStorage.getTrace({ traceId: 'trace-1' });
        const span1 = trace!.spans.find(s => s.spanId === 'span-1');
        const span2 = trace!.spans.find(s => s.spanId === 'span-2');
        expect(span1!.output).toBe('result-1');
        expect(span2!.output).toBe('result-2');
      });

      it('should update spans across multiple traces', async () => {
        await observabilityStorage.batchCreateSpans({
          records: [
            createSpan({ traceId: 'trace-1', spanId: 'span-1' }),
            createSpan({ traceId: 'trace-2', spanId: 'span-2' }),
          ],
        });

        await observabilityStorage.batchUpdateSpans({
          records: [
            { traceId: 'trace-1', spanId: 'span-1', updates: { name: 'Updated 1' } },
            { traceId: 'trace-2', spanId: 'span-2', updates: { name: 'Updated 2' } },
          ],
        });

        const trace1 = await observabilityStorage.getTrace({ traceId: 'trace-1' });
        const trace2 = await observabilityStorage.getTrace({ traceId: 'trace-2' });
        expect(trace1!.spans[0]!.name).toBe('Updated 1');
        expect(trace2!.spans[0]!.name).toBe('Updated 2');
      });
    });

    describe('batchDeleteTraces', () => {
      it('should delete traces and all their spans', async () => {
        await observabilityStorage.batchCreateSpans({
          records: [
            createSpan({ traceId: 'trace-1', spanId: 'span-1' }),
            createSpan({ traceId: 'trace-1', spanId: 'span-2', parentSpanId: 'span-1' }),
            createSpan({ traceId: 'trace-2', spanId: 'span-3' }),
            createSpan({ traceId: 'trace-3', spanId: 'span-4' }),
          ],
        });

        await observabilityStorage.batchDeleteTraces({ traceIds: ['trace-1', 'trace-3'] });

        expect(await observabilityStorage.getTrace({ traceId: 'trace-1' })).toBeNull();
        expect(await observabilityStorage.getTrace({ traceId: 'trace-2' })).not.toBeNull();
        expect(await observabilityStorage.getTrace({ traceId: 'trace-3' })).toBeNull();
      });

      it('should handle deleting non-existent traces gracefully', async () => {
        await expect(observabilityStorage.batchDeleteTraces({ traceIds: ['non-existent'] })).resolves.not.toThrow();
      });
    });

    describe('listTraces', () => {
      const createMultipleTraces = async () => {
        const baseDate = DEFAULT_BASE_DATE;

        const traces = [
          // Trace 1: Success, agent, production
          createSpan({
            traceId: 'trace-1',
            spanId: 'root-1',
            spanType: SpanType.AGENT_RUN,
            entityType: EntityType.AGENT,
            entityId: 'agent-1',
            entityName: 'Agent One',
            environment: 'production',
            userId: 'user-1',
            tags: ['important', 'customer'],
            metadata: { priority: 'high' },
            startedAt: baseDate,
            endedAt: new Date(baseDate.getTime() + 1000),
          }),
          // Trace 2: Error, workflow, staging
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
          // Trace 3: Running, agent, production
          createSpan({
            traceId: 'trace-3',
            spanId: 'root-3',
            spanType: SpanType.AGENT_RUN,
            entityType: EntityType.AGENT,
            entityId: 'agent-2',
            entityName: 'Agent Two',
            environment: 'production',
            userId: 'user-1',
            tags: ['important'],
            startedAt: new Date(baseDate.getTime() + 4000),
            endedAt: null,
          }),
          // Trace 4: Success with tool call
          createSpan({
            traceId: 'trace-4',
            spanId: 'root-4',
            spanType: SpanType.TOOL_CALL,
            entityType: EntityType.TOOL,
            entityId: 'tool-1',
            entityName: 'Tool One',
            environment: 'production',
            startedAt: new Date(baseDate.getTime() + 5000),
            endedAt: new Date(baseDate.getTime() + 6000),
          }),
        ];

        await observabilityStorage.batchCreateSpans({ records: traces });

        // Add child span with error to trace-1 (for hasChildError tests)
        await observabilityStorage.createSpan({
          span: createSpan({
            traceId: 'trace-1',
            spanId: 'child-1',
            parentSpanId: 'root-1',
            error: { message: 'Child error' },
            startedAt: new Date(baseDate.getTime() + 500),
            endedAt: new Date(baseDate.getTime() + 800),
          }),
        });
      };

      describe('basic pagination', () => {
        it('should return empty list when no traces exist', async () => {
          const result = await observabilityStorage.listTraces({});

          expect(result.spans).toEqual([]);
          expect(result.pagination.total).toBe(0);
        });

        it('should return root spans with pagination info', async () => {
          await createMultipleTraces();

          const result = await observabilityStorage.listTraces({
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.spans.length).toBe(4);
          expect(result.pagination.total).toBe(4);
          expect(result.pagination.page).toBe(0);
          expect(result.pagination.perPage).toBe(10);
        });

        it('should respect perPage limit', async () => {
          await createMultipleTraces();

          const result = await observabilityStorage.listTraces({
            pagination: { page: 0, perPage: 2 },
          });

          expect(result.spans.length).toBeLessThanOrEqual(2);
          expect(result.pagination.perPage).toBe(2);
        });

        it('should handle page navigation', async () => {
          await createMultipleTraces();

          const page1 = await observabilityStorage.listTraces({
            pagination: { page: 0, perPage: 2 },
          });

          const page2 = await observabilityStorage.listTraces({
            pagination: { page: 1, perPage: 2 },
          });

          // Ensure different spans on different pages
          expect(page1.spans[0]?.traceId).not.toBe(page2.spans[0]?.traceId);
          expect(page1.pagination.page).toBe(0);
          expect(page2.pagination.page).toBe(1);
        });
      });

      describe('filtering', () => {
        beforeEach(async () => {
          await createMultipleTraces();
        });

        it('should filter by spanType', async () => {
          const result = await observabilityStorage.listTraces({
            filters: { spanType: SpanType.WORKFLOW_RUN },
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.spans.length).toBe(1);
          expect(result.spans[0]!.traceId).toBe('trace-2');
        });

        it('should filter by entityType', async () => {
          const result = await observabilityStorage.listTraces({
            filters: { entityType: EntityType.AGENT },
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.spans.length).toBe(2);
          expect(result.spans.every((s: SpanRecord) => s.entityType === EntityType.AGENT)).toBe(true);
        });

        it('should filter by entityId', async () => {
          const result = await observabilityStorage.listTraces({
            filters: { entityId: 'agent-1' },
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.spans.length).toBe(1);
          expect(result.spans[0]!.traceId).toBe('trace-1');
        });

        it('should filter by entityName', async () => {
          const result = await observabilityStorage.listTraces({
            filters: { entityName: 'Workflow One' },
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.spans.length).toBe(1);
          expect(result.spans[0]!.traceId).toBe('trace-2');
        });

        it('should filter by userId', async () => {
          const result = await observabilityStorage.listTraces({
            filters: { userId: 'user-1' },
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.spans.length).toBe(2);
        });

        it('should filter by environment', async () => {
          const result = await observabilityStorage.listTraces({
            filters: { environment: 'production' },
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.spans.length).toBe(3);
        });

        it('should return empty results for non-matching filters', async () => {
          const result = await observabilityStorage.listTraces({
            filters: { entityId: 'non-existent-entity' },
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.spans).toHaveLength(0);
          expect(result.pagination.total).toBe(0);
        });
      });

      describe('status filters', () => {
        beforeEach(async () => {
          await createMultipleTraces();
        });

        it('should filter by status SUCCESS', async () => {
          const result = await observabilityStorage.listTraces({
            filters: { status: TraceStatus.SUCCESS },
            pagination: { page: 0, perPage: 10 },
          });

          // trace-1 and trace-4 have endedAt and no error on root
          expect(result.spans.length).toBeGreaterThanOrEqual(1);
          result.spans.forEach((span: SpanRecord) => {
            expect(span.error).toBeNull();
            expect(span.endedAt).not.toBeNull();
          });
        });

        it('should filter by status ERROR', async () => {
          const result = await observabilityStorage.listTraces({
            filters: { status: TraceStatus.ERROR },
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.spans.length).toBe(1);
          expect(result.spans[0]!.traceId).toBe('trace-2');
        });

        it('should filter by status RUNNING', async () => {
          const result = await observabilityStorage.listTraces({
            filters: { status: TraceStatus.RUNNING },
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.spans.length).toBe(1);
          expect(result.spans[0]!.traceId).toBe('trace-3');
        });
      });

      describe('date range filtering', () => {
        beforeEach(async () => {
          await createMultipleTraces();
        });

        it('should filter by startedAt date range', async () => {
          const baseDate = DEFAULT_BASE_DATE;
          const result = await observabilityStorage.listTraces({
            filters: {
              startedAt: {
                start: new Date(baseDate.getTime() + 1000),
                end: new Date(baseDate.getTime() + 3000),
              },
            },
            pagination: { page: 0, perPage: 10 },
          });

          // Should match trace-2 (started at baseDate + 2000)
          expect(result.spans.length).toBe(1);
          expect(result.spans[0]!.traceId).toBe('trace-2');
        });

        it('should handle start date only', async () => {
          const baseDate = DEFAULT_BASE_DATE;
          const result = await observabilityStorage.listTraces({
            filters: {
              startedAt: { start: new Date(baseDate.getTime() + 4000) },
            },
            pagination: { page: 0, perPage: 10 },
          });

          // Should match trace-3 and trace-4
          expect(result.spans.length).toBe(2);
        });
      });

      describe('combined filters', () => {
        beforeEach(async () => {
          await createMultipleTraces();
        });

        it('should combine multiple filters', async () => {
          const result = await observabilityStorage.listTraces({
            filters: {
              entityType: EntityType.AGENT,
              environment: 'production',
              status: TraceStatus.SUCCESS,
            },
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.spans.length).toBe(1);
          expect(result.spans[0]!.traceId).toBe('trace-1');
        });
      });
    });

    describe('correlation ID filters', () => {
      beforeEach(async () => {
        await observabilityStorage.dangerouslyClearAll();
        await observabilityStorage.batchCreateSpans({
          records: [
            createSpan({
              traceId: 'trace-1',
              spanId: 'span-1',
              runId: 'run-123',
              sessionId: 'session-abc',
              threadId: 'thread-xyz',
              requestId: 'req-001',
            }),
            createSpan({
              traceId: 'trace-2',
              spanId: 'span-2',
              runId: 'run-456',
              sessionId: 'session-abc',
              threadId: null,
              requestId: null,
            }),
          ],
        });
      });

      it('should filter by runId', async () => {
        const result = await observabilityStorage.listTraces({ filters: { runId: 'run-123' } });
        expect(result.spans.length).toBe(1);
        expect(result.spans[0]!.traceId).toBe('trace-1');
      });

      it('should filter by sessionId', async () => {
        const result = await observabilityStorage.listTraces({ filters: { sessionId: 'session-abc' } });
        expect(result.spans.length).toBe(2);
      });

      it('should filter by threadId', async () => {
        const result = await observabilityStorage.listTraces({ filters: { threadId: 'thread-xyz' } });
        expect(result.spans.length).toBe(1);
        expect(result.spans[0]!.traceId).toBe('trace-1');
      });

      it('should filter by requestId', async () => {
        const result = await observabilityStorage.listTraces({ filters: { requestId: 'req-001' } });
        expect(result.spans.length).toBe(1);
        expect(result.spans[0]!.traceId).toBe('trace-1');
      });
    });

    describe('deployment context filters', () => {
      beforeEach(async () => {
        await observabilityStorage.dangerouslyClearAll();
        await observabilityStorage.batchCreateSpans({
          records: [
            createSpan({
              traceId: 'trace-1',
              spanId: 'span-1',
              environment: 'production',
              source: 'cloud',
              serviceName: 'api-service',
            }),
            createSpan({
              traceId: 'trace-2',
              spanId: 'span-2',
              environment: 'staging',
              source: 'local',
              serviceName: 'api-service',
            }),
          ],
        });
      });

      it('should filter by source', async () => {
        const result = await observabilityStorage.listTraces({ filters: { source: 'cloud' } });
        expect(result.spans.length).toBe(1);
        expect(result.spans[0]!.traceId).toBe('trace-1');
      });

      it('should filter by serviceName', async () => {
        const result = await observabilityStorage.listTraces({ filters: { serviceName: 'api-service' } });
        expect(result.spans.length).toBe(2);
      });
    });

    describe('identity filters', () => {
      beforeEach(async () => {
        await observabilityStorage.dangerouslyClearAll();
        await observabilityStorage.batchCreateSpans({
          records: [
            createSpan({
              traceId: 'trace-1',
              spanId: 'span-1',
              userId: 'user-1',
              organizationId: 'org-a',
              resourceId: 'resource-x',
            }),
            createSpan({
              traceId: 'trace-2',
              spanId: 'span-2',
              userId: 'user-2',
              organizationId: 'org-a',
              resourceId: 'resource-y',
            }),
          ],
        });
      });

      it('should filter by organizationId', async () => {
        const result = await observabilityStorage.listTraces({ filters: { organizationId: 'org-a' } });
        expect(result.spans.length).toBe(2);
      });

      it('should filter by resourceId', async () => {
        const result = await observabilityStorage.listTraces({ filters: { resourceId: 'resource-x' } });
        expect(result.spans.length).toBe(1);
        expect(result.spans[0]!.traceId).toBe('trace-1');
      });
    });

    describe('ordering', () => {
      /**
       * Creates 3 root spans for ordering tests:
       * - trace-1: started at baseDate, ended at baseDate+1000 (oldest, completed)
       * - trace-2: started at baseDate+2000, ended at baseDate+3000 (middle, completed)
       * - trace-3: started at baseDate+4000, endedAt=null (newest, still running)
       *
       * Expected behavior:
       * - Default: startedAt DESC (newest first)
       * - startedAt ASC: oldest first (startedAt is required, never null)
       * - startedAt DESC: newest first (startedAt is required, never null)
       * - endedAt ASC: oldest completed first, NULLs LAST (running spans at end)
       * - endedAt DESC: newest completed first, NULLs FIRST (running spans on top)
       */
      beforeEach(async () => {
        await observabilityStorage.dangerouslyClearAll();
        const baseDate = DEFAULT_BASE_DATE;

        await observabilityStorage.batchCreateSpans({
          records: [
            // Trace 1: oldest, completed
            createSpan({
              traceId: 'trace-1',
              spanId: 'root-1',
              startedAt: new Date(baseDate.getTime()),
              endedAt: new Date(baseDate.getTime() + 1000),
            }),
            // Trace 2: middle, completed
            createSpan({
              traceId: 'trace-2',
              spanId: 'root-2',
              startedAt: new Date(baseDate.getTime() + 2000),
              endedAt: new Date(baseDate.getTime() + 3000),
            }),
            // Trace 3: newest, still running (null endedAt)
            createSpan({
              traceId: 'trace-3',
              spanId: 'root-3',
              startedAt: new Date(baseDate.getTime() + 4000),
              endedAt: null,
            }),
          ],
        });
      });

      describe('startedAt ordering', () => {
        it('should sort by startedAt DESC by default (newest first)', async () => {
          const result = await observabilityStorage.listTraces({});

          expect(result.spans.length).toBe(3);
          expect(result.spans[0]!.traceId).toBe('trace-3'); // newest
          expect(result.spans[1]!.traceId).toBe('trace-2');
          expect(result.spans[2]!.traceId).toBe('trace-1'); // oldest
        });

        it('should sort by startedAt ASC (oldest first)', async () => {
          const result = await observabilityStorage.listTraces({
            orderBy: { field: 'startedAt', direction: 'ASC' },
          });

          expect(result.spans.length).toBe(3);
          expect(result.spans[0]!.traceId).toBe('trace-1'); // oldest
          expect(result.spans[1]!.traceId).toBe('trace-2');
          expect(result.spans[2]!.traceId).toBe('trace-3'); // newest
        });

        it('should sort by startedAt DESC (newest first)', async () => {
          const result = await observabilityStorage.listTraces({
            orderBy: { field: 'startedAt', direction: 'DESC' },
          });

          expect(result.spans.length).toBe(3);
          expect(result.spans[0]!.traceId).toBe('trace-3'); // newest
          expect(result.spans[1]!.traceId).toBe('trace-2');
          expect(result.spans[2]!.traceId).toBe('trace-1'); // oldest
        });
      });

      describe('endedAt ordering', () => {
        it('should sort by endedAt DESC with NULLs first (running spans on top)', async () => {
          const result = await observabilityStorage.listTraces({
            orderBy: { field: 'endedAt', direction: 'DESC' },
          });

          expect(result.spans.length).toBe(3);
          // Running span (null endedAt) should be first
          expect(result.spans[0]!.traceId).toBe('trace-3');
          // Then newest completed
          expect(result.spans[1]!.traceId).toBe('trace-2');
          // Then oldest completed
          expect(result.spans[2]!.traceId).toBe('trace-1');
        });

        it('should sort by endedAt ASC with NULLs last (oldest completed first)', async () => {
          const result = await observabilityStorage.listTraces({
            orderBy: { field: 'endedAt', direction: 'ASC' },
          });

          expect(result.spans.length).toBe(3);
          // Oldest completed first
          expect(result.spans[0]!.traceId).toBe('trace-1');
          // Then newest completed
          expect(result.spans[1]!.traceId).toBe('trace-2');
          // Running span (null endedAt) should be last
          expect(result.spans[2]!.traceId).toBe('trace-3');
        });
      });
    });
  });
}

// Re-export data helpers for use in tests
export { createSpan, createRootSpan, createChildSpan, DEFAULT_BASE_DATE } from './data';
