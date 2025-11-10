import { SpanType } from '@mastra/core/observability';
import { MastraStorage, TABLE_SPANS } from '@mastra/core/storage';
import type { SpanRecord } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRootSpan, createChildSpan } from './data';

export function createObservabilityTests({ storage }: { storage: MastraStorage }) {
  describe('Span Operations', () => {
    beforeEach(async () => {
      await storage.clearTable({ tableName: TABLE_SPANS });
    });

    describe('single span', () => {
      it('should store the span successfully', async () => {
        const span = createRootSpan({ name: 'test-root-span', scope: 'test-scope' });

        await expect(storage.createSpan(span)).resolves.not.toThrow();
      });

      it('should make the span retrievable via trace', async () => {
        const span = createRootSpan({ name: 'test-root-span', scope: 'test-scope' });
        await storage.createSpan(span);

        const trace = await storage.getTrace(span.traceId);

        expect(trace?.traceId).toBe(span.traceId);
        expect(trace?.spans).toHaveLength(1);
      });

      it('should preserve span properties', async () => {
        const span = createRootSpan({ name: 'test-root-span', scope: 'test-scope' });
        await storage.createSpan(span);

        const trace = await storage.getTrace(span.traceId);
        const retrievedSpan = trace?.spans[0];

        expect(retrievedSpan).toMatchObject({
          name: span.name,
          spanType: span.spanType,
          parentSpanId: null,
          attributes: expect.objectContaining(span.attributes),
          metadata: expect.objectContaining(span.metadata),
          input: span.input,
          output: span.output,
          error: span.error,
        });
        // Database should set createdAt/updatedAt, not preserve application-provided ones
        expect(retrievedSpan?.createdAt).toBeDefined();
        expect(retrievedSpan?.updatedAt).toBeDefined();
      });

      it('should handle primitive values in JSONB fields (strings, numbers, booleans)', async () => {
        // Regression test for PostgreSQL "invalid input syntax for type json" bug
        // Bug: JSONB columns require valid JSON, but primitive strings were not being stringified
        // This test ensures all storage providers properly handle primitives in JSONB fields
        const span = createRootSpan({
          name: 'test-primitive-jsonb',
          scope: 'test-scope',
        });

        // Override with primitive values that should be JSON-encoded
        span.input = 'Tell me a story about a dragon' as any; // Plain string
        span.output = 'Once upon a time there was a dragon...' as any; // Plain string
        span.attributes = { temperature: 0.7, maxTokens: 100 } as any; // Object with number values
        span.metadata = { isTest: true, retryCount: 3 } as any; // Object with boolean and number

        await storage.createSpan(span);

        const trace = await storage.getTrace(span.traceId);
        const retrievedSpan = trace?.spans[0];

        expect(retrievedSpan).toBeDefined();

        // Verify primitive strings are retrieved as strings (not corrupted)
        expect(retrievedSpan?.input).toBe('Tell me a story about a dragon');
        expect(retrievedSpan?.output).toBe('Once upon a time there was a dragon...');

        // Verify objects with primitives are retrieved correctly
        expect(retrievedSpan?.attributes).toEqual({ temperature: 0.7, maxTokens: 100 });
        expect(retrievedSpan?.metadata).toEqual({ isTest: true, retryCount: 3 });
      });
    });

    describe('parent and child spans', () => {
      it('should create and store parent-child span hierarchy', async () => {
        const scope = 'test-scope';
        const traceId = `test-trace-${Date.now()}`;

        const rootSpan = createRootSpan({ name: 'root-span', scope, traceId });
        const childSpan = createChildSpan({ name: 'child-span', scope, parentSpanId: rootSpan.spanId, traceId });

        // Test storage operations
        await expect(storage.createSpan(rootSpan)).resolves.not.toThrow();
        await expect(storage.createSpan(childSpan)).resolves.not.toThrow();
      });

      it('should retrieve complete trace with proper hierarchy', async () => {
        const scope = 'test-scope';
        const traceId = `test-trace-${Date.now()}`;

        const rootSpan = createRootSpan({ name: 'root-span', scope, traceId });
        const childSpan = createChildSpan({ name: 'child-span', scope, parentSpanId: rootSpan.spanId, traceId });

        await storage.createSpan(rootSpan);
        await storage.createSpan(childSpan);

        const trace = await storage.getTrace(traceId);

        expect(trace).toBeDefined();
        expect(trace!.spans).toHaveLength(2);

        // Verify hierarchy
        const rootInTrace = trace!.spans.find(s => s.spanId === rootSpan.spanId);
        const childInTrace = trace!.spans.find(s => s.spanId === childSpan.spanId);

        expect(rootInTrace!.parentSpanId).toBeNull();
        expect(childInTrace!.parentSpanId).toBe(rootSpan.spanId);
      });
    });

    describe('updateSpan', () => {
      it('should update the span successfully', async () => {
        const span = createRootSpan({ name: 'test-root-span', scope: 'test-scope' });
        await storage.createSpan(span);

        await storage.updateSpan({
          spanId: span.spanId,
          traceId: span.traceId,
          updates: {
            name: 'updated-root-span',
          },
        });

        const updatedSpan = await storage.getTrace(span.traceId);
        expect(updatedSpan?.spans[0]?.name).toBe('updated-root-span');
      });

      it('should update the span and preserve other properties', async () => {
        const span = createRootSpan({ name: 'test-root-span', scope: 'test-scope' });
        await storage.createSpan(span);

        await storage.updateSpan({
          spanId: span.spanId,
          traceId: span.traceId,
          updates: {
            name: 'updated-root-span',
          },
        });

        const updatedSpan = await storage.getTrace(span.traceId);
        expect(updatedSpan?.spans[0]?.name).toBe('updated-root-span');
        expect(updatedSpan?.spans[0]?.spanType).toBe(span.spanType);
      });
    });

    describe('batchCreateSpans', () => {
      it('should create multiple spans in batch and make them retrievable', async () => {
        const spans = [
          createRootSpan({ name: 'root-span-1', scope: 'test-scope' }),
          createRootSpan({ name: 'root-span-2', scope: 'test-scope' }),
          createRootSpan({ name: 'root-span-3', scope: 'test-scope' }),
        ];

        await storage.batchCreateSpans({ records: spans });

        for (const span of spans) {
          const trace = await storage.getTrace(span.traceId);
          expect(trace).toBeDefined();
          expect(trace!.spans).toHaveLength(1);
          expect(trace!.spans[0]?.name).toBe(span.name);
        }
      });

      it('should handle empty batch gracefully', async () => {
        await expect(storage.batchCreateSpans({ records: [] })).resolves.not.toThrow();
      });

      it('should preserve span properties in batch creation', async () => {
        const span = createRootSpan({
          name: 'test-span-properties',
          scope: 'test-scope',
          startedAt: new Date('2024-01-01T00:00:00Z'),
          endedAt: new Date('2024-01-01T00:00:01Z'),
        });

        await storage.batchCreateSpans({ records: [span] });

        const trace = await storage.getTrace(span.traceId);
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

    describe('batchUpdateSpans', () => {
      it('should update a single span in batch', async () => {
        const span = createRootSpan({ name: 'test-root-span', scope: 'test-scope' });
        await storage.createSpan(span);

        await storage.batchUpdateSpans({
          records: [{ traceId: span.traceId, spanId: span.spanId, updates: { name: 'updated-root-span' } }],
        });

        const updatedSpan = await storage.getTrace(span.traceId);
        expect(updatedSpan?.spans[0]?.name).toBe('updated-root-span');
      });

      it('should update a multiple spans in batch', async () => {
        const spans = [
          createRootSpan({ name: 'test-root-span', scope: 'test-scope' }),
          createRootSpan({ name: 'test-root-span-2', scope: 'test-scope' }),
        ] as SpanRecord[];

        await storage.batchCreateSpans({ records: spans });

        const updates = [
          { traceId: spans[0]!.traceId, spanId: spans[0]!.spanId, updates: { name: 'updated-root-span-1' } },
          { traceId: spans[1]!.traceId, spanId: spans[1]!.spanId, updates: { name: 'updated-root-span-2' } },
        ];

        await storage.batchUpdateSpans({ records: updates });

        const updatedSpan1 = await storage.getTrace(spans[0]!.traceId);
        const updatedSpan2 = await storage.getTrace(spans[1]!.traceId);
        expect(updatedSpan1?.spans[0]?.name).toBe('updated-root-span-1');
        expect(updatedSpan2?.spans[0]?.name).toBe('updated-root-span-2');
      });
    });

    describe('batchDeleteSpans', () => {
      it('should delete a multiple spans in batch', async () => {
        const spans = [
          createRootSpan({ name: 'test-root-span', scope: 'test-scope' }),
          createRootSpan({ name: 'test-root-span-2', scope: 'test-scope' }),
        ];

        await storage.batchCreateSpans({ records: spans });

        const beforeTrace1 = await storage.getTrace(spans[0]!.traceId);
        const beforeTrace2 = await storage.getTrace(spans[1]!.traceId);
        expect(beforeTrace1?.spans).toHaveLength(1);
        expect(beforeTrace2?.spans).toHaveLength(1);

        await storage.batchDeleteTraces({ traceIds: [spans[0]!.traceId, spans[1]!.traceId] });

        const afterTrace1 = await storage.getTrace(spans[0]!.traceId);
        const afterTrace2 = await storage.getTrace(spans[1]!.traceId);
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

        await storage.batchCreateSpans({ records: [rootSpan, childSpan1, childSpan2] });

        const beforeTrace = await storage.getTrace(rootSpan.traceId);
        expect(beforeTrace?.spans).toHaveLength(3);

        await storage.batchDeleteTraces({ traceIds: [rootSpan.traceId] });

        const afterTrace = await storage.getTrace(rootSpan.traceId);
        expect(afterTrace).toBeNull();
      });
    });

    describe('getTracesPaginated', () => {
      beforeEach(async () => {
        // Create test traces with different properties for filtering
        const traces = [
          // Trace 1: Workflow spans
          createRootSpan({
            name: 'workflow-trace-1',
            scope: 'test-scope',
            spanType: SpanType.WORKFLOW_RUN,
            startedAt: new Date('2024-01-01T00:00:00Z'),
          }),
          // Trace 2: Agent spans
          createRootSpan({
            name: 'agent-trace-1',
            scope: 'test-scope',
            spanType: SpanType.AGENT_RUN,
            startedAt: new Date('2024-01-02T00:00:00Z'),
          }),
          // Trace 3: Tool spans
          createRootSpan({
            name: 'tool-trace-1',
            scope: 'test-scope',
            spanType: SpanType.TOOL_CALL,
            startedAt: new Date('2024-01-03T00:00:00Z'),
          }),
          // Trace 4: Another workflow
          createRootSpan({
            name: 'workflow-trace-2',
            scope: 'test-scope',
            spanType: SpanType.WORKFLOW_RUN,
            startedAt: new Date('2024-01-04T00:00:00Z'),
          }),
        ];

        await storage.batchCreateSpans({ records: traces });
      });

      describe('basic pagination', () => {
        it('should return root spans with pagination info', async () => {
          const result = await storage.getTracesPaginated({
            pagination: { page: 0, perPage: 10 },
          });

          expect(result).toHaveProperty('spans');
          expect(result).toHaveProperty('pagination');
          expect(Array.isArray(result.spans)).toBe(true);
        });

        it('should respect perPage limit', async () => {
          const result = await storage.getTracesPaginated({
            pagination: { page: 0, perPage: 2 },
          });

          expect(result.spans.length).toBeLessThanOrEqual(2);
          expect(result.pagination.perPage).toBe(2);
        });

        it('should handle page navigation', async () => {
          const page1 = await storage.getTracesPaginated({
            pagination: { page: 0, perPage: 2 },
          });

          const page2 = await storage.getTracesPaginated({
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
          const result = await storage.getTracesPaginated({
            filters: { spanType: SpanType.WORKFLOW_RUN },
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.spans.length).toBeGreaterThan(0);

          // All returned traces should have workflow spans
          result.spans.forEach(span => {
            const hasWorkflowSpan = span.spanType === SpanType.WORKFLOW_RUN;
            expect(hasWorkflowSpan).toBe(true);
          });
        });

        it('should filter by name', async () => {
          const result = await storage.getTracesPaginated({
            filters: { name: 'workflow-trace-1' },
            pagination: { page: 0, perPage: 10 },
          });

          // Should find the specific trace
          expect(result.spans.length).toBeGreaterThan(0);
          const foundSpan = result.spans.find(span => span.name === 'workflow-trace-1');
          expect(foundSpan).toBeDefined();
        });

        it('should return empty results for non-matching filters', async () => {
          const result = await storage.getTracesPaginated({
            filters: { name: 'non-existent-trace' },
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.spans).toHaveLength(0);
          expect(result.pagination.total).toBe(0);
        });
      });

      describe('date range filtering', () => {
        it('should filter by date range', async () => {
          const result = await storage.getTracesPaginated({
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
          const result = await storage.getTracesPaginated({
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
