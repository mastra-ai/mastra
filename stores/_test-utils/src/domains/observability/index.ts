import { AISpanType } from '@mastra/core/ai-tracing';
import { MastraStorage, TABLE_AI_SPANS } from '@mastra/core/storage';
import type { AISpanRecord } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRootSpan, createChildSpan } from './data';

export function createObservabilityTests({ storage }: { storage: MastraStorage }) {
  describe('AI Span Operations', () => {
    beforeEach(async () => {
      await storage.clearTable({ tableName: TABLE_AI_SPANS });
    });

    describe('single span', () => {
      it('should store the span successfully', async () => {
        const span = createRootSpan({ name: 'test-root-span', scope: 'test-scope' });

        await expect(storage.createAISpan(span)).resolves.not.toThrow();
      });

      it('should make the span retrievable via trace', async () => {
        const span = createRootSpan({ name: 'test-root-span', scope: 'test-scope' });
        await storage.createAISpan(span);

        const trace = await storage.getAITrace(span.traceId);

        expect(trace?.traceId).toBe(span.traceId);
        expect(trace?.spans).toHaveLength(1);
      });

      it('should preserve span properties', async () => {
        const span = createRootSpan({ name: 'test-root-span', scope: 'test-scope' });
        await storage.createAISpan(span);

        const trace = await storage.getAITrace(span.traceId);
        const retrievedSpan = trace?.spans[0];

        expect(retrievedSpan).toMatchObject({
          name: span.name,
          spanType: span.spanType,
          parentSpanId: null,
          attributes: expect.objectContaining(span.attributes),
          metadata: expect.objectContaining(span.metadata),
          createdAt: span.createdAt,
          updatedAt: span.updatedAt,
          input: span.input,
          output: span.output,
          error: span.error,
        });
      });
    });

    describe('parent and child spans', () => {
      it('should create and store parent-child span hierarchy', async () => {
        const scope = 'test-scope';
        const traceId = `test-trace-${Date.now()}`;

        const rootSpan = createRootSpan({ name: 'root-span', scope, traceId });
        const childSpan = createChildSpan({ name: 'child-span', scope, parentSpanId: rootSpan.spanId, traceId });

        // Test storage operations
        await expect(storage.createAISpan(rootSpan)).resolves.not.toThrow();
        await expect(storage.createAISpan(childSpan)).resolves.not.toThrow();
      });

      it('should retrieve complete trace with proper hierarchy', async () => {
        const scope = 'test-scope';
        const traceId = `test-trace-${Date.now()}`;

        const rootSpan = createRootSpan({ name: 'root-span', scope, traceId });
        const childSpan = createChildSpan({ name: 'child-span', scope, parentSpanId: rootSpan.spanId, traceId });

        await storage.createAISpan(rootSpan);
        await storage.createAISpan(childSpan);

        const trace = await storage.getAITrace(traceId);

        expect(trace).toBeDefined();
        expect(trace!.spans).toHaveLength(2);

        // Verify hierarchy
        const rootInTrace = trace!.spans.find(s => s.spanId === rootSpan.spanId);
        const childInTrace = trace!.spans.find(s => s.spanId === childSpan.spanId);

        expect(rootInTrace!.parentSpanId).toBeNull();
        expect(childInTrace!.parentSpanId).toBe(rootSpan.spanId);
      });
    });

    describe('updateAISpan', () => {
      it('should update the span successfully', async () => {
        const span = createRootSpan({ name: 'test-root-span', scope: 'test-scope' });
        await storage.createAISpan(span);

        await storage.updateAISpan({
          spanId: span.spanId,
          traceId: span.traceId,
          updates: {
            name: 'updated-root-span',
          },
        });

        const updatedSpan = await storage.getAITrace(span.traceId);
        expect(updatedSpan?.spans[0]?.name).toBe('updated-root-span');
      });

      it('should update the span and preserve other properties', async () => {
        const span = createRootSpan({ name: 'test-root-span', scope: 'test-scope' });
        await storage.createAISpan(span);

        await storage.updateAISpan({
          spanId: span.spanId,
          traceId: span.traceId,
          updates: {
            name: 'updated-root-span',
          },
        });

        const updatedSpan = await storage.getAITrace(span.traceId);
        expect(updatedSpan?.spans[0]?.name).toBe('updated-root-span');
        expect(updatedSpan?.spans[0]?.spanType).toBe(span.spanType);
      });
    });

    describe('batchCreateAISpans', () => {
      it('should create multiple spans in batch and make them retrievable', async () => {
        const spans = [
          createRootSpan({ name: 'root-span-1', scope: 'test-scope' }),
          createRootSpan({ name: 'root-span-2', scope: 'test-scope' }),
          createRootSpan({ name: 'root-span-3', scope: 'test-scope' }),
        ];

        await storage.batchCreateAISpans({ records: spans });

        for (const span of spans) {
          const trace = await storage.getAITrace(span.traceId);
          expect(trace).toBeDefined();
          expect(trace!.spans).toHaveLength(1);
          expect(trace!.spans[0]?.name).toBe(span.name);
        }
      });

      it('should handle empty batch gracefully', async () => {
        await expect(storage.batchCreateAISpans({ records: [] })).resolves.not.toThrow();
      });

      it('should preserve span properties in batch creation', async () => {
        const span = createRootSpan({
          name: 'test-span-properties',
          scope: 'test-scope',
          startedAt: new Date('2024-01-01T00:00:00Z'),
          endedAt: new Date('2024-01-01T00:00:01Z'),
        });

        await storage.batchCreateAISpans({ records: [span] });

        const trace = await storage.getAITrace(span.traceId);
        const retrievedSpan = trace!.spans[0];

        expect(retrievedSpan).toMatchObject({
          name: span.name,
          scope: span.scope,
          spanType: span.spanType,
          parentSpanId: span.parentSpanId,
          startedAt: span.startedAt,
          endedAt: span.endedAt,
          attributes: expect.objectContaining(span.attributes),
          metadata: expect.objectContaining(span.metadata),
        });
      });
    });

    describe('batchUpdateAISpans', () => {
      it('should update a single span in batch', async () => {
        const span = createRootSpan({ name: 'test-root-span', scope: 'test-scope' });
        await storage.createAISpan(span);

        await storage.batchUpdateAISpans({
          records: [{ traceId: span.traceId, spanId: span.spanId, updates: { name: 'updated-root-span' } }],
        });

        const updatedSpan = await storage.getAITrace(span.traceId);
        expect(updatedSpan?.spans[0]?.name).toBe('updated-root-span');
      });

      it('should update a multiple spans in batch', async () => {
        const spans = [
          createRootSpan({ name: 'test-root-span', scope: 'test-scope' }),
          createRootSpan({ name: 'test-root-span-2', scope: 'test-scope' }),
        ] as AISpanRecord[];

        await storage.batchCreateAISpans({ records: spans });

        const updates = [
          { traceId: spans[0]!.traceId, spanId: spans[0]!.spanId, updates: { name: 'updated-root-span-1' } },
          { traceId: spans[1]!.traceId, spanId: spans[1]!.spanId, updates: { name: 'updated-root-span-2' } },
        ];

        await storage.batchUpdateAISpans({ records: updates });

        const updatedSpan1 = await storage.getAITrace(spans[0]!.traceId);
        const updatedSpan2 = await storage.getAITrace(spans[1]!.traceId);
        expect(updatedSpan1?.spans[0]?.name).toBe('updated-root-span-1');
        expect(updatedSpan2?.spans[0]?.name).toBe('updated-root-span-2');
      });
    });

    describe('batchDeleteAISpans', () => {
      it('should delete a multiple spans in batch', async () => {
        const spans = [
          createRootSpan({ name: 'test-root-span', scope: 'test-scope' }),
          createRootSpan({ name: 'test-root-span-2', scope: 'test-scope' }),
        ];

        await storage.batchCreateAISpans({ records: spans });

        const beforeTrace1 = await storage.getAITrace(spans[0]!.traceId);
        const beforeTrace2 = await storage.getAITrace(spans[1]!.traceId);
        expect(beforeTrace1?.spans).toHaveLength(1);
        expect(beforeTrace2?.spans).toHaveLength(1);

        await storage.batchDeleteAITraces({ traceIds: [spans[0]!.traceId, spans[1]!.traceId] });

        const afterTrace1 = await storage.getAITrace(spans[0]!.traceId);
        const afterTrace2 = await storage.getAITrace(spans[1]!.traceId);
        expect(afterTrace1).toBeNull();
        expect(afterTrace2).toBeNull();
      });

      it('should delete multiple spans in a single trace', async () => {
        const rootSpan = createRootSpan({ name: 'test-root-span', scope: 'test-scope' });
        const childSpan1 = createChildSpan({
          name: 'test-child-span',
          scope: 'test-scope',
          parentSpanId: rootSpan.spanId,
          traceId: rootSpan.traceId,
        });
        const childSpan2 = createChildSpan({
          name: 'test-child-span-2',
          scope: 'test-scope',
          parentSpanId: rootSpan.spanId,
          traceId: rootSpan.traceId,
        });

        await storage.batchCreateAISpans({ records: [rootSpan, childSpan1, childSpan2] });

        const beforeTrace = await storage.getAITrace(rootSpan.traceId);
        expect(beforeTrace?.spans).toHaveLength(3);

        await storage.batchDeleteAITraces({ traceIds: [rootSpan.traceId] });

        const afterTrace = await storage.getAITrace(rootSpan.traceId);
        expect(afterTrace).toBeNull();
      });
    });

    describe('getAITracesPaginated', () => {
      beforeEach(async () => {
        // Create test traces with different properties for filtering
        const traces = [
          // Trace 1: Workflow spans
          createRootSpan({
            name: 'workflow-trace-1',
            scope: 'test-scope',
            spanType: AISpanType.WORKFLOW_RUN,
            startedAt: new Date('2024-01-01T00:00:00Z'),
          }),
          // Trace 2: Agent spans
          createRootSpan({
            name: 'agent-trace-1',
            scope: 'test-scope',
            spanType: AISpanType.AGENT_RUN,
            startedAt: new Date('2024-01-02T00:00:00Z'),
          }),
          // Trace 3: Tool spans
          createRootSpan({
            name: 'tool-trace-1',
            scope: 'test-scope',
            spanType: AISpanType.TOOL_CALL,
            startedAt: new Date('2024-01-03T00:00:00Z'),
          }),
          // Trace 4: Another workflow
          createRootSpan({
            name: 'workflow-trace-2',
            scope: 'test-scope',
            spanType: AISpanType.WORKFLOW_RUN,
            startedAt: new Date('2024-01-04T00:00:00Z'),
          }),
        ];

        await storage.batchCreateAISpans({ records: traces });
      });

      describe('basic pagination', () => {
        it('should return root spans with pagination info', async () => {
          const result = await storage.getAITracesPaginated({
            pagination: { page: 0, perPage: 10 },
          });

          expect(result).toHaveProperty('spans');
          expect(result).toHaveProperty('pagination');
          expect(Array.isArray(result.spans)).toBe(true);
        });

        it('should respect perPage limit', async () => {
          const result = await storage.getAITracesPaginated({
            pagination: { page: 0, perPage: 2 },
          });

          expect(result.spans.length).toBeLessThanOrEqual(2);
          expect(result.pagination.perPage).toBe(2);
        });

        it('should handle page navigation', async () => {
          const page1 = await storage.getAITracesPaginated({
            pagination: { page: 0, perPage: 2 },
          });

          const page2 = await storage.getAITracesPaginated({
            pagination: { page: 1, perPage: 2 },
          });

          // Ensure different spans on different pages (if enough data exists)
          expect(page1.spans[0]?.traceId).not.toBe(page2.spans[0]?.traceId);
          expect(page1.pagination.page).toBe(0);
          expect(page2.pagination.page).toBe(1);
        });
      });

      describe('filtering', () => {
        it('should filter by span type', async () => {
          const result = await storage.getAITracesPaginated({
            filters: { spanType: AISpanType.WORKFLOW_RUN },
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.spans.length).toBeGreaterThan(0);

          // All returned traces should have workflow spans
          result.spans.forEach(span => {
            const hasWorkflowSpan = span.spanType === AISpanType.WORKFLOW_RUN;
            expect(hasWorkflowSpan).toBe(true);
          });
        });

        it('should filter by name', async () => {
          const result = await storage.getAITracesPaginated({
            filters: { name: 'workflow-trace-1' },
            pagination: { page: 0, perPage: 10 },
          });

          // Should find the specific trace
          expect(result.spans.length).toBeGreaterThan(0);
          const foundSpan = result.spans.find(span => span.name === 'workflow-trace-1');
          expect(foundSpan).toBeDefined();
        });

        it('should return empty results for non-matching filters', async () => {
          const result = await storage.getAITracesPaginated({
            filters: { name: 'non-existent-trace' },
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.spans).toHaveLength(0);
          expect(result.pagination.total).toBe(0);
        });
      });

      describe('date range filtering', () => {
        it('should filter by date range', async () => {
          const result = await storage.getAITracesPaginated({
            pagination: {
              dateRange: {
                start: new Date('2024-01-01T00:00:00Z'),
                end: new Date('2024-01-02T23:59:59Z'),
              },
              page: 0,
              perPage: 10,
            },
          });

          expect(result.spans.length).toBeGreaterThan(0);

          // All traces should be within the date range
          result.spans.forEach(span => {
            expect(span.startedAt.getTime()).toBeGreaterThanOrEqual(new Date('2024-01-01T00:00:00Z').getTime());
            expect(span.startedAt.getTime()).toBeLessThanOrEqual(new Date('2024-01-02T23:59:59Z').getTime());
          });
        });

        it('should handle start date only', async () => {
          const result = await storage.getAITracesPaginated({
            pagination: {
              dateRange: { start: new Date('2024-01-03T00:00:00Z') },
              page: 0,
              perPage: 10,
            },
          });

          expect(result.spans.length).toBeGreaterThan(0);

          // All traces should be after the start date
          result.spans.forEach(span => {
            expect(span.startedAt.getTime()).toBeGreaterThanOrEqual(new Date('2024-01-03T00:00:00Z').getTime());
          });
        });
      });
    });
  });
}
