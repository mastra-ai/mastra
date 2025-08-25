import { randomUUID } from 'crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { AISpanType } from '@mastra/core/ai-tracing';
import { TABLE_AI_SPAN } from '@mastra/core/storage';
import type { MastraStorage } from '@mastra/core/storage';
import {
  createSampleAgentRunSpan,
  createSampleAiSpan,
  createSampleLLMSpan,
  createSampleToolSpan,
  createSampleWorkflowSpan,
  createSpanHierarchy,
  createMultipleSpanHierarchies,
} from './data';

export function createObservabilityTests({ storage }: { storage: MastraStorage }) {
  describe('AI Span Operations', () => {
    beforeEach(async () => {
      await storage.clearTable({ tableName: TABLE_AI_SPAN });
    });

    describe('createAISpan', () => {
      it('should create a new AI span with required fields', async () => {
        const span = createSampleAgentRunSpan('test-agent-run');

        await storage.createAISpan(span);

        // Verify the span was created
        const retrievedSpan = await storage.getAISpan(`${span.traceId}-${span.spanId}`);
        expect(retrievedSpan).toBeDefined();
        expect(retrievedSpan?.id).toBe(`${span.traceId}-${span.spanId}`);
        expect(retrievedSpan?.name).toBe(span.name);
        expect(retrievedSpan?.spanType).toBe(span.spanType);
        expect(retrievedSpan?.traceId).toBe(span.traceId);
      });

      it('should create AI spans of different types', async () => {
        const agentSpan = createSampleAgentRunSpan('agent-span');
        const llmSpan = createSampleLLMSpan('llm-span');
        const toolSpan = createSampleToolSpan('tool-span');
        const workflowSpan = createSampleWorkflowSpan('workflow-span');

        await storage.createAISpan(agentSpan);
        await storage.createAISpan(llmSpan);
        await storage.createAISpan(toolSpan);
        await storage.createAISpan(workflowSpan);

        expect(await storage.getAISpan(`${agentSpan.traceId}-${agentSpan.spanId}`)).toBeDefined();
        expect(await storage.getAISpan(`${llmSpan.traceId}-${llmSpan.spanId}`)).toBeDefined();
        expect(await storage.getAISpan(`${toolSpan.traceId}-${toolSpan.spanId}`)).toBeDefined();
        expect(await storage.getAISpan(`${workflowSpan.traceId}-${workflowSpan.spanId}`)).toBeDefined();
      });

      it('should handle spans with attributes and metadata', async () => {
        const span = createSampleAiSpan(
          'test-span',
          AISpanType.AGENT_RUN,
          { environment: 'test', version: '1.0' },
          { environment: 'test', version: '1.0' },
          { agentId: 'agent-123', model: 'gpt-4' },
        );

        await storage.createAISpan(span);

        const retrievedSpan = await storage.getAISpan(`${span.traceId}-${span.spanId}`);

        expect(retrievedSpan?.attributes?.environment).toBe('test');
        expect(retrievedSpan?.attributes?.version).toBe('1.0');
        expect(retrievedSpan?.metadata?.agentId).toBe('agent-123');
        expect(retrievedSpan?.metadata?.model).toBe('gpt-4');
      });
    });

    describe('getAISpan', () => {
      it('should retrieve an AI span by ID', async () => {
        const span = createSampleAgentRunSpan('test-span');
        await storage.createAISpan(span);

        const retrievedSpan = await storage.getAISpan(`${span.traceId}-${span.spanId}`);
        expect(retrievedSpan).toBeDefined();
        expect(retrievedSpan?.id).toBe(`${span.traceId}-${span.spanId}`);
      });

      it('should return null for non-existent span ID', async () => {
        const nonExistentId = `span-${randomUUID()}`;
        const result = await storage.getAISpan(nonExistentId);
        expect(result).toBeNull();
      });
    });

    describe('getAITrace', () => {
      it('should retrieve all spans for a given trace ID', async () => {
        // Create a span hierarchy with multiple spans sharing the same traceId
        const hierarchy = createSpanHierarchy('parent-span', ['child-1', 'child-2'], {
          parentSpanType: AISpanType.AGENT_RUN,
          childSpanType: AISpanType.LLM_GENERATION,
        });

        // Create all spans
        await storage.createAISpan(hierarchy.parent);

        for (const child of hierarchy.children) {
          (child as any).parentSpanId = `${hierarchy.parent.traceId}-${hierarchy.parent.spanId}`;
          await storage.createAISpan(child);
        }

        // Get all spans for the trace
        const trace = await storage.getAITrace(hierarchy.parent.traceId);

        expect(trace).toBeDefined();
        expect(trace?.traceId).toBe(hierarchy.parent.traceId);
        expect(trace?.spans).toHaveLength(3); // 1 parent + 2 children

        // Verify all spans have the same traceId
        expect(trace?.spans.every(span => span.traceId === hierarchy.parent.traceId)).toBe(true);

        // Verify parent-child relationships
        const parentSpan = trace?.spans.find(s => s.parentSpanId === null);
        const childSpans = trace?.spans.filter(s => s.parentSpanId !== null);

        expect(parentSpan).toBeDefined();
        expect(parentSpan?.name).toBe('parent-span');
        expect(childSpans).toHaveLength(2);
        expect(
          childSpans?.every(child => child.parentSpanId === `${hierarchy.parent.traceId}-${hierarchy.parent.spanId}`),
        ).toBe(true);
      });

      it('should return null for non-existent trace ID', async () => {
        const nonExistentTraceId = `trace-${randomUUID()}`;
        const result = await storage.getAITrace(nonExistentTraceId);
        expect(result).toBeNull();
      });

      it('should handle trace with single span', async () => {
        const span = createSampleAgentRunSpan('single-span1');
        await storage.createAISpan(span);

        const trace = await storage.getAITrace(span.traceId);

        expect(trace).toBeDefined();
        expect(trace?.traceId).toBe(span.traceId);
        expect(trace?.spans).toHaveLength(1);
        expect(trace?.spans[0]?.name).toBe('single-span1');
        expect(trace?.spans[0]?.parentSpanId).toBeNull();
      });
    });

    describe('GetAiTracesPaginated', () => {
      it('should return paginated AI spans with total count based on parent spans only', async () => {
        // Create 15 span hierarchies (each with 1 parent + 2 children)
        const hierarchies = createMultipleSpanHierarchies(15, {
          parentNamePrefix: 'parent-span',
          childNames: ['child-1', 'child-2'],
        });

        // Create all parent spans first
        for (const { parent } of hierarchies) {
          await storage.createAISpan(parent);
        }

        // Create all child spans with correct parentSpanId
        for (const { parent, children } of hierarchies) {
          const parentId = `${parent.traceId}-${parent.spanId}`;

          for (const child of children) {
            (child as any).parentSpanId = parentId;
            await storage.createAISpan(child);
          }
        }

        // Test first page - should return 8 parent spans only
        const page1 = await storage.getAITracesPaginated({
          page: 0,
          perPage: 8,
        });

        // 8 parent spans only (no children)
        expect(page1.spans).toHaveLength(8);
        expect(page1.total).toBe(15); // Total parent spans
        expect(page1.page).toBe(0);
        expect(page1.perPage).toBe(8);
        expect(page1.hasMore).toBe(true);

        // Test second page - should return 7 parent spans only
        const page2 = await storage.getAITracesPaginated({
          page: 1,
          perPage: 8,
        });
        // 7 parent spans only (no children)
        expect(page2.spans).toHaveLength(7);
        expect(page2.total).toBe(15); // Total parent spans
        expect(page2.page).toBe(1);
        expect(page2.perPage).toBe(8);
        expect(page2.hasMore).toBe(false);
      });

      it('should filter by name on parent spans only', async () => {
        // Create span hierarchies with different names
        const hierarchies = [
          createSpanHierarchy('agent-parent-1', ['child-1']),
          createSpanHierarchy('agent-parent-2', ['child-2']),
          createSpanHierarchy('llm-parent-1', ['child-3']),
          createSpanHierarchy('llm-parent-2', ['child-4']),
        ];

        // Create all spans
        for (const { parent, children } of hierarchies) {
          await storage.createAISpan(parent);

          for (const child of children) {
            (child as any).parentSpanId = `${parent.traceId}-${parent.spanId}`;
            await storage.createAISpan(child);
          }
        }

        // Filter by exact name - should only match parent spans with exact names
        const agentSpans = await storage.getAITracesPaginated({
          filters: {
            name: 'agent-parent-1',
          },
          page: 0,
          perPage: 10,
        });
        expect(agentSpans.total).toBe(1); // Only parent spans count toward total
        expect(agentSpans.spans).toHaveLength(1); // 1 parent span only (no children)
      });

      it('should filter by attributes using JSON field extraction', async () => {
        const attributes1 = { environment: 'prod', region: 'us-east' };
        const attributes2 = { environment: 'dev', region: 'us-west' };

        const hierarchy1 = createSpanHierarchy('prod-parent', ['prod-child'], { attributes: attributes1 });
        const hierarchy2 = createSpanHierarchy('dev-parent', ['dev-child'], { attributes: attributes2 });

        // Create all spans
        for (const { parent, children } of [hierarchy1, hierarchy2]) {
          await storage.createAISpan(parent);

          for (const child of children) {
            (child as any).parentSpanId = `${parent.traceId}-${parent.spanId}`;
            await storage.createAISpan(child);
          }
        }

        // Filter by attributes - should match using json_extract
        const prodSpans = await storage.getAITracesPaginated({
          filters: {
            attributes: { environment: attributes1.environment },
          },
          page: 0,
          perPage: 10,
        });
        expect(prodSpans.total).toBe(1); // Only parent spans count
        expect(prodSpans.spans).toHaveLength(1); // 1 parent span only (no children)
        expect(prodSpans.spans.every(span => span.attributes?.environment === attributes1.environment)).toBe(true);
      });

      it('should return complete span trees with nested children', async () => {
        // Create a multi-level span hierarchy
        const parentSpan = createSampleAgentRunSpan('parent');
        const childSpan = createSampleAgentRunSpan('child');
        const grandchildSpan = createSampleAgentRunSpan('grandchild');
        const greatGrandchildSpan = createSampleAgentRunSpan('great-grandchild');

        // Ensure all spans share the same traceId
        const sharedTraceId = parentSpan.traceId;
        (childSpan as any).traceId = sharedTraceId;
        (grandchildSpan as any).traceId = sharedTraceId;
        (greatGrandchildSpan as any).traceId = sharedTraceId;

        // Create parent span first
        await storage.createAISpan(parentSpan);

        // Set child's parentSpanId to parent's actual ID
        (childSpan as any).parentSpanId = `${parentSpan.traceId}-${parentSpan.spanId}`;
        await storage.createAISpan(childSpan);

        // Set grandchild's parentSpanId to child's actual ID
        (grandchildSpan as any).parentSpanId = `${childSpan.traceId}-${childSpan.spanId}`;
        await storage.createAISpan(grandchildSpan);

        // Set great-grandchild's parentSpanId to grandchild's actual ID
        (greatGrandchildSpan as any).parentSpanId = `${grandchildSpan.traceId}-${grandchildSpan.spanId}`;
        await storage.createAISpan(greatGrandchildSpan);

        // Get paginated results
        const result = await storage.getAITracesPaginated({ page: 0, perPage: 1 });

        // Should return 1 parent span only (no children)
        expect(result.spans).toHaveLength(1);
        expect(result.total).toBe(1); // Only parent spans count toward total

        // Verify the parent span
        const parentSpanInResult = result.spans.find(s => s.parentSpanId === null);
        expect(parentSpanInResult).toBeDefined();
        expect(parentSpanInResult?.traceId).toBe(sharedTraceId);
      });

      it('should sort parent spans by start time (newest first)', async () => {
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;
        const twoHoursAgo = now - 2 * 60 * 60 * 1000;

        // Create span hierarchies with different start times
        const hierarchy1 = createSpanHierarchy('oldest-parent', ['child-1'], {
          startTime: twoHoursAgo,
        });
        const hierarchy2 = createSpanHierarchy('middle-parent', ['child-2'], {
          startTime: oneHourAgo,
        });
        const hierarchy3 = createSpanHierarchy('newest-parent', ['child-3'], {
          startTime: now,
        });

        const hierarchies = [hierarchy1, hierarchy2, hierarchy3];

        // Create all spans
        for (const { parent, children } of hierarchies) {
          await storage.createAISpan(parent);

          for (const child of children) {
            (child as any).parentSpanId = `${parent.traceId}-${parent.spanId}`;
            await storage.createAISpan(child);
          }
        }

        const result = await storage.getAITracesPaginated({
          page: 0,
          perPage: 10,
        });

        // Should return only parent spans
        expect(result.spans).toHaveLength(3); // 3 parent spans only
        expect(result.total).toBe(3); // Only parent spans count toward total

        // Parent spans should be ordered by start time (newest first)
        expect(result.spans[0]?.name).toBe('newest-parent');
        expect(result.spans[1]?.name).toBe('middle-parent');
        expect(result.spans[2]?.name).toBe('oldest-parent');
      });

      it('should handle empty results gracefully', async () => {
        // Don't create any spans

        const result = await storage.getAITracesPaginated({
          page: 0,
          perPage: 10,
        });

        expect(result.spans).toHaveLength(0);
        expect(result.total).toBe(0);
        expect(result.page).toBe(0);
        expect(result.perPage).toBe(10);
        expect(result.hasMore).toBe(false);
      });

      it('should handle single page results', async () => {
        // Create only 3 span hierarchies (less than perPage)
        const hierarchies = createMultipleSpanHierarchies(3, {
          parentNamePrefix: 'single-page',
          childNames: ['child'],
        });

        // Create all spans
        for (const { parent, children } of hierarchies) {
          await storage.createAISpan(parent);

          for (const child of children) {
            (child as any).parentSpanId = `${parent.traceId}-${parent.spanId}`;
            await storage.createAISpan(child);
          }
        }

        const result = await storage.getAITracesPaginated({
          page: 0,
          perPage: 10,
        });

        expect(result.spans).toHaveLength(3); // 3 parent spans only
        expect(result.total).toBe(3);
        expect(result.page).toBe(0);
        expect(result.perPage).toBe(10);
        expect(result.hasMore).toBe(false); // No more pages
      });

      it('should handle complex filtering combinations', async () => {
        // Create span hierarchies with different characteristics
        const hierarchies = [
          createSpanHierarchy('prod-workflow-1', ['step1', 'step2'], {
            scope: { environment: 'prod', region: 'us-east' },
            attributes: { priority: 'high', team: 'backend' },
          }),
          createSpanHierarchy('prod-workflow-2', ['step1', 'step2'], {
            scope: { environment: 'prod', region: 'us-west' },
            attributes: { priority: 'medium', team: 'frontend' },
          }),
          createSpanHierarchy('dev-workflow-1', ['step1'], {
            scope: { environment: 'dev', region: 'us-east' },
            attributes: { priority: 'low', team: 'qa' },
          }),
          createSpanHierarchy('staging-workflow-1', ['step1'], {
            scope: { environment: 'staging', region: 'eu-west' },
            attributes: { priority: 'medium', team: 'devops' },
          }),
        ];

        // Create all spans
        for (const { parent, children } of hierarchies) {
          await storage.createAISpan(parent);

          for (const child of children) {
            (child as any).parentSpanId = `${parent.traceId}-${parent.spanId}`;
            await storage.createAISpan(child);
          }
        }

        // Test complex filtering - filter by exact name 'prod-workflow-1' and priority 'high'
        const prodHighPrioritySpans = await storage.getAITracesPaginated({
          filters: {
            name: 'prod-workflow-1',
            attributes: { priority: 'high' },
          },
          page: 0,
          perPage: 10,
        });

        expect(prodHighPrioritySpans.total).toBe(1); // Only 1 parent matches
        expect(prodHighPrioritySpans.spans).toHaveLength(1); // 1 parent span only
        expect(prodHighPrioritySpans.spans[0]?.name).toBe('prod-workflow-1');
      });

      it('should maintain span relationships across pagination', async () => {
        // Create 25 span hierarchies to test pagination boundaries
        const hierarchies = createMultipleSpanHierarchies(25, {
          parentNamePrefix: 'pagination-test',
          childNames: ['child-a', 'child-b', 'child-c'],
        });

        // Create all spans
        for (const { parent, children } of hierarchies) {
          await storage.createAISpan(parent);

          for (const child of children) {
            (child as any).parentSpanId = `${parent.traceId}-${parent.spanId}`;
            await storage.createAISpan(child);
          }
        }

        // Test first page (10 items per page)
        const page1 = await storage.getAITracesPaginated({
          page: 0,
          perPage: 10,
        });

        expect(page1.spans).toHaveLength(10); // 10 parent spans only
        expect(page1.total).toBe(25);
        expect(page1.hasMore).toBe(true);

        // Test second page
        const page2 = await storage.getAITracesPaginated({
          page: 1,
          perPage: 10,
        });

        expect(page2.spans).toHaveLength(10); // 10 parent spans only
        expect(page2.total).toBe(25);
        expect(page2.hasMore).toBe(true);

        // Test last page
        const page3 = await storage.getAITracesPaginated({
          page: 2,
          perPage: 10,
        });

        expect(page3.spans).toHaveLength(5); // 5 parent spans only
        expect(page3.total).toBe(25);
        expect(page3.hasMore).toBe(false);

        // Verify that all spans in each page are parent spans
        for (const page of [page1, page2, page3]) {
          expect(page.spans.every(span => span.parentSpanId === null)).toBe(true);
        }
      });

      it('should filter by direct column fields', async () => {
        // Create spans with different span types and statuses
        const hierarchies = [
          createSpanHierarchy('agent-span', ['child'], {
            parentSpanType: AISpanType.AGENT_RUN, // Agent run
            childSpanType: AISpanType.LLM_GENERATION, // LLM
          }),
          createSpanHierarchy('tool-span', ['child'], {
            parentSpanType: AISpanType.TOOL_CALL, // Tool
            childSpanType: AISpanType.WORKFLOW_RUN, // Workflow
          }),
          createSpanHierarchy('llm-span', ['child'], {
            parentSpanType: AISpanType.LLM_GENERATION, // LLM
            childSpanType: AISpanType.AGENT_RUN, // Agent run
          }),
        ];

        // Create all spans
        for (const { parent, children } of hierarchies) {
          await storage.createAISpan(parent);

          for (const child of children) {
            (child as any).parentSpanId = `${parent.traceId}-${parent.spanId}`;
            await storage.createAISpan(child);
          }
        }

        // Filter by spanType - should find 1 parent span with spanType 0
        const agentSpans = await storage.getAITracesPaginated({
          filters: {
            spanType: AISpanType.AGENT_RUN,
          },
          page: 0,
          perPage: 10,
        });
        expect(agentSpans.total).toBe(1); // 1 parent span with spanType 0
        expect(agentSpans.spans).toHaveLength(1); // 1 parent span only

        // Filter by multiple direct columns
        const agentAndToolSpans = await storage.getAITracesPaginated({
          filters: {
            spanType: AISpanType.AGENT_RUN,
            // Add a custom filter to demonstrate flexibility
            traceId: hierarchies?.[0]?.parent.traceId,
          },
          page: 0,
          perPage: 10,
        });
        expect(agentAndToolSpans.total).toBe(1); // Only 1 parent span matches both criteria
        expect(agentAndToolSpans.spans).toHaveLength(1); // 1 parent span only
      });

      it('should combine JSON and direct column filtering', async () => {
        // Create spans with different characteristics
        const hierarchies = [
          createSpanHierarchy('prod-agent', ['child'], {
            attributes: { team: 'backend' },
            parentSpanType: AISpanType.AGENT_RUN,
          }),
          createSpanHierarchy('prod-tool', ['child'], {
            attributes: { team: 'frontend' },
            parentSpanType: AISpanType.TOOL_CALL,
          }),
          createSpanHierarchy('dev-agent', ['child'], {
            attributes: { team: 'backend' },
            parentSpanType: AISpanType.AGENT_RUN,
          }),
        ];

        // Create all spans
        for (const { parent, children } of hierarchies) {
          await storage.createAISpan(parent);

          for (const child of children) {
            (child as any).parentSpanId = `${parent.traceId}-${parent.spanId}`;
            await storage.createAISpan(child);
          }
        }

        // Filter by attributes (JSON field) and spanType (direct column)
        const backendAgents = await storage.getAITracesPaginated({
          filters: {
            attributes: { team: 'backend' },
            spanType: AISpanType.AGENT_RUN,
          },
          page: 0,
          perPage: 10,
        });
        expect(backendAgents.total).toBe(2);
        expect(backendAgents.spans).toHaveLength(2); // 2 parent spans only
      });

      it('should filter by date range using Date objects', async () => {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

        // Create span hierarchies with different start times
        const hierarchies = [
          createSpanHierarchy('old-span', ['child'], {
            startTime: twoHoursAgo.getTime(),
          }),
          createSpanHierarchy('recent-span', ['child'], {
            startTime: oneHourAgo.getTime(),
          }),
          createSpanHierarchy('new-span', ['child'], {
            startTime: now.getTime(),
          }),
        ];

        // Create all spans
        for (const { parent, children } of hierarchies) {
          await storage.createAISpan(parent);

          for (const child of children) {
            (child as any).parentSpanId = `${parent.traceId}-${parent.spanId}`;
            await storage.createAISpan(child);
          }
        }

        // Filter by date range - should return spans started in the last hour
        const recentSpans = await storage.getAITracesPaginated({
          filters: {
            dateRange: {
              start: oneHourAgo,
              end: now,
            },
          },
          page: 0,
          perPage: 10,
        });

        expect(recentSpans.total).toBe(2); // 2 parent spans started in the last hour
        expect(recentSpans.spans).toHaveLength(2); // 2 parent spans only
        expect(recentSpans.spans.map(s => s.name)).toContain('recent-span');
        expect(recentSpans.spans.map(s => s.name)).toContain('new-span');
        expect(recentSpans.spans.map(s => s.name)).not.toContain('old-span');
      });

      it('should filter by date range using ISO strings', async () => {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

        // Create span hierarchies with different start times
        const hierarchies = [
          createSpanHierarchy('old-day-span', ['child'], {
            startTime: twoDaysAgo.getTime(),
          }),
          createSpanHierarchy('yesterday-span', ['child'], {
            startTime: oneDayAgo.getTime(),
          }),
          createSpanHierarchy('today-span', ['child'], {
            startTime: now.getTime(),
          }),
        ];

        // Create all spans
        for (const { parent, children } of hierarchies) {
          await storage.createAISpan(parent);

          for (const child of children) {
            (child as any).parentSpanId = `${parent.traceId}-${parent.spanId}`;
            await storage.createAISpan(child);
          }
        }

        // Filter by date range using ISO strings - should return spans from yesterday and today
        const recentSpans = await storage.getAITracesPaginated({
          filters: {
            dateRange: {
              start: oneDayAgo.toISOString(),
              end: now.toISOString(),
            },
          },
          page: 0,
          perPage: 10,
        });

        expect(recentSpans.total).toBe(2); // 2 parent spans from yesterday and today
        expect(recentSpans.spans).toHaveLength(2); // 2 parent spans only
        expect(recentSpans.spans?.map(s => s.name)).toContain('yesterday-span');
        expect(recentSpans.spans?.map(s => s.name)).toContain('today-span');
        expect(recentSpans.spans?.map(s => s.name)).not.toContain('old-day-span');
      });
    });

    describe('updateAISpan', () => {
      it('should update an existing AI span', async () => {
        const span = createSampleAgentRunSpan('test-span');
        await storage.createAISpan(span);

        const updates = {
          name: 'updated-span-name',
          metadata: { status: 'completed', result: 'success' },
        };

        await storage.updateAISpan(`${span.traceId}-${span.spanId}`, updates);

        const updatedSpan = await storage.getAISpan(`${span.traceId}-${span.spanId}`);
        expect(updatedSpan?.name).toBe('updated-span-name');
        expect(updatedSpan?.metadata?.status).toBe('completed');
        expect(updatedSpan?.metadata?.result).toBe('success');
      });

      it('should throw error when updating non-existent span', async () => {
        const nonExistentId = `span-${randomUUID()}`;
        const updates = { name: 'updated-name' };

        await expect(storage.updateAISpan(nonExistentId, updates)).rejects.toThrow();
      });
    });

    describe('deleteAISpan', () => {
      it('should delete an existing AI span', async () => {
        const span = createSampleAgentRunSpan('test-span');
        await storage.createAISpan(span);

        await storage.deleteAISpan(`${span.traceId}-${span.spanId}`);

        const deletedSpan = await storage.getAISpan(`${span.traceId}-${span.spanId}`);
        expect(deletedSpan).toBeNull();
      });

      it('should handle deleting non-existent span gracefully', async () => {
        const nonExistentId = `span-${randomUUID()}`;

        // Should not throw an error
        await storage.deleteAISpan(nonExistentId);
      });
    });

    describe('Batch Operations', () => {
      it('should create multiple AI spans in batch', async () => {
        const spans = [
          createSampleAgentRunSpan('batch-span-1'),
          createSampleLLMSpan('batch-span-2'),
          createSampleToolSpan('batch-span-3'),
        ];

        await storage.batchCreateAISpan({ records: spans });

        for (const span of spans) {
          const retrievedSpan = await storage.getAISpan(`${span.traceId}-${span.spanId}`);
          expect(retrievedSpan).toBeDefined();
          expect(retrievedSpan?.id).toBe(`${span.traceId}-${span.spanId}`);
        }
      });

      it('should update multiple AI spans in batch', async () => {
        const spans = [createSampleAgentRunSpan('batch-update-1'), createSampleAgentRunSpan('batch-update-2')];

        // Create spans first
        for (const span of spans) {
          await storage.createAISpan(span);
        }

        const updates = [
          {
            id: `${spans[0]?.traceId}-${spans[0]?.spanId}`,
            updates: { name: 'updated-1', metadata: { status: 'completed' } },
          },
          {
            id: `${spans[1]?.traceId}-${spans[1]?.spanId}`,
            updates: { name: 'updated-2', metadata: { status: 'completed' } },
          },
        ];

        await storage.batchUpdateAISpan({ records: updates });

        for (const update of updates) {
          const updatedSpan = await storage.getAISpan(update.id);
          expect(updatedSpan?.name).toBe(update.updates.name);
          expect(updatedSpan?.metadata?.status).toBe(update.updates.metadata.status);
        }
      });

      it('should delete multiple AI spans in batch', async () => {
        const spans = [
          createSampleAgentRunSpan('batch-delete-1'),
          createSampleAgentRunSpan('batch-delete-2'),
          createSampleAgentRunSpan('batch-delete-3'),
        ];

        // Create spans first
        for (const span of spans) {
          await storage.createAISpan(span);
        }

        const idsToDelete = spans.map(span => `${span.traceId}-${span.spanId}`);
        await storage.batchDeleteAISpan({ ids: idsToDelete });

        for (const id of idsToDelete) {
          const deletedSpan = await storage.getAISpan(id);
          expect(deletedSpan).toBeNull();
        }
      });
    });

    describe('Edge Cases and Error Handling', () => {
      it('should handle spans with missing optional fields', async () => {
        const spanId = `span-${randomUUID()}`;
        const traceId = `trace-${randomUUID()}`;
        const minimalSpan = {
          id: `${traceId}-${spanId}`,
          traceId,
          spanId,
          parentSpanId: null,
          name: 'minimal-span',
          scope: null,
          spanType: 0,
          attributes: null,
          metadata: null,
          events: null,
          links: null,
          other: null,
          startTime: Date.now(),
          endTime: 0,
          createdAt: new Date(),
          input: null,
          output: null,
          error: null,
        };

        await storage.createAISpan(minimalSpan);

        const retrievedSpan = await storage.getAISpan(minimalSpan.id);
        expect(retrievedSpan).toBeDefined();
        expect(retrievedSpan?.id).toBe(minimalSpan.id);
      });

      it('should handle large numbers of spans', async () => {
        const largeSpans = Array.from({ length: 100 }, (_, i) => createSampleAgentRunSpan(`large-span-${i}`));

        // Create spans in smaller batches to avoid overwhelming the storage
        const batchSize = 20;
        for (let i = 0; i < largeSpans.length; i += batchSize) {
          const batch = largeSpans.slice(i, i + batchSize);
          await storage.batchCreateAISpan({ records: batch });
        }

        const result = await storage.getAITracesPaginated({
          page: 0,
          perPage: 50,
        });

        expect(result.total).toBe(100);
        expect(result.spans).toHaveLength(50); // 50 parent spans only
        expect(result.hasMore).toBe(true);
      });
    });
  });
}
