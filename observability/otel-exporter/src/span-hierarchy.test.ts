/**
 * Tests for span hierarchy and parent-child relationships
 */

import { SpanType } from '@mastra/core/observability';
import type {
  ExportedSpan,
  AgentRunAttributes,
  ModelGenerationAttributes,
  ToolCallAttributes,
  WorkflowRunAttributes,
  WorkflowStepAttributes,
} from '@mastra/core/observability';
import { describe, it, expect, beforeEach } from 'vitest';
import { SpanConverter } from './span-converter.js';

describe('Span Hierarchy and Parent-Child Relationships', () => {
  let converter: SpanConverter;

  beforeEach(() => {
    converter = new SpanConverter();
  });

  describe('Parent Span ID Preservation', () => {
    it('should preserve parentSpanId from Mastra span', () => {
      const rootSpan: ExportedSpan<SpanType.AGENT_RUN> = {
        id: 'root-span',
        traceId: 'trace-1',
        name: 'agent-run',
        type: SpanType.AGENT_RUN,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: true,
        parentSpanId: undefined, // Root has no parent
        attributes: {
          agentId: 'test-agent',
        } as AgentRunAttributes,
      };

      const childSpan: ExportedSpan<SpanType.MODEL_GENERATION> = {
        id: 'child-span',
        traceId: 'trace-1',
        name: 'llm-gen',
        type: SpanType.MODEL_GENERATION,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        parentSpanId: 'root-span', // Child references parent
        attributes: {
          model: 'gpt-4',
        } as ModelGenerationAttributes,
      };

      const rootResult = converter.convertSpan(rootSpan);
      const childResult = converter.convertSpan(childSpan);

      expect(rootResult.parentSpanId).toBeUndefined();
      expect(childResult.parentSpanId).toBe('root-span');
    });

    it('should handle multi-level hierarchy', () => {
      const rootSpan: ExportedSpan<SpanType.WORKFLOW_RUN> = {
        id: 'workflow-root',
        traceId: 'trace-1',
        name: 'workflow',
        type: SpanType.WORKFLOW_RUN,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: true,
        parentSpanId: undefined,
        attributes: {
          workflowId: 'main-workflow',
        } as WorkflowRunAttributes,
      };

      const stepSpan: ExportedSpan<SpanType.WORKFLOW_STEP> = {
        id: 'step-1',
        traceId: 'trace-1',
        name: 'step',
        type: SpanType.WORKFLOW_STEP,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        parentSpanId: 'workflow-root',
        attributes: {
          stepId: 'process-data',
        } as WorkflowStepAttributes,
      };

      const llmSpan: ExportedSpan<SpanType.MODEL_GENERATION> = {
        id: 'llm-1',
        traceId: 'trace-1',
        name: 'llm',
        type: SpanType.MODEL_GENERATION,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        parentSpanId: 'step-1',
        attributes: {
          model: 'claude-3',
        } as ModelGenerationAttributes,
      };

      const toolSpan: ExportedSpan<SpanType.TOOL_CALL> = {
        id: 'tool-1',
        traceId: 'trace-1',
        name: 'tool',
        type: SpanType.TOOL_CALL,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        parentSpanId: 'llm-1',
        attributes: {
          toolId: 'calculator',
        } as ToolCallAttributes,
      };

      const rootResult = converter.convertSpan(rootSpan);
      const stepResult = converter.convertSpan(stepSpan);
      const llmResult = converter.convertSpan(llmSpan);
      const toolResult = converter.convertSpan(toolSpan);

      // Verify hierarchy
      expect(rootResult.parentSpanId).toBeUndefined();
      expect(stepResult.parentSpanId).toBe('workflow-root');
      expect(llmResult.parentSpanId).toBe('step-1');
      expect(toolResult.parentSpanId).toBe('llm-1');
    });
  });

  describe('Trace Context Preservation', () => {
    it('should maintain trace ID across all spans', () => {
      const traceId = '32-char-trace-id-for-otel-compat';

      const spans: ExportedSpan<any>[] = [
        {
          id: 'span-1',
          traceId,
          name: 'agent',
          type: SpanType.AGENT_RUN,
          startTime: new Date(),
          endTime: new Date(),
          isEvent: false,
          isRootSpan: true,
          parentSpanId: undefined,
          attributes: { agentId: 'test' } as AgentRunAttributes,
        },
        {
          id: 'span-2',
          traceId,
          name: 'llm',
          type: SpanType.MODEL_GENERATION,
          startTime: new Date(),
          endTime: new Date(),
          isEvent: false,
          isRootSpan: false,
          parentSpanId: 'span-1',
          attributes: { model: 'gpt-4' } as ModelGenerationAttributes,
        },
        {
          id: 'span-3',
          traceId,
          name: 'tool',
          type: SpanType.TOOL_CALL,
          startTime: new Date(),
          endTime: new Date(),
          isEvent: false,
          isRootSpan: false,
          parentSpanId: 'span-1',
          attributes: { toolId: 'search' } as ToolCallAttributes,
        },
      ];

      const results = spans.map(span => converter.convertSpan(span));

      // All spans should have the same trace ID
      results.forEach(result => {
        expect(result.spanContext().traceId).toBe(traceId);
      });

      // Verify parent relationships
      expect(results[0].parentSpanId).toBeUndefined();
      expect(results[1].parentSpanId).toBe('span-1');
      expect(results[2].parentSpanId).toBe('span-1');
    });

    it('should preserve span IDs', () => {
      const span: ExportedSpan<SpanType.AGENT_RUN> = {
        id: 'unique-span-id-123',
        traceId: 'trace-abc',
        name: 'agent',
        type: SpanType.AGENT_RUN,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: true,
        parentSpanId: undefined,
        attributes: { agentId: 'test' } as AgentRunAttributes,
      };

      const result = converter.convertSpan(span);

      expect(result.spanContext().spanId).toBe('unique-span-id-123');
      expect(result.spanContext().traceId).toBe('trace-abc');
    });
  });

  describe('Complex Agent Execution Hierarchy', () => {
    it('should handle typical agent execution with tools and LLM calls', () => {
      const baseTime = new Date();
      const spans: ExportedSpan<any>[] = [
        // Root agent span
        {
          id: 'agent-1',
          traceId: 'trace-1',
          name: 'agent-run',
          type: SpanType.AGENT_RUN,
          startTime: baseTime,
          endTime: new Date(baseTime.getTime() + 10000),
          isEvent: false,
          isRootSpan: true,
          parentSpanId: undefined,
          attributes: {
            agentId: 'customer-support',
            maxSteps: 5,
          } as AgentRunAttributes,
        },
        // First LLM call (planning)
        {
          id: 'llm-1',
          traceId: 'trace-1',
          name: 'llm-planning',
          type: SpanType.MODEL_GENERATION,
          startTime: new Date(baseTime.getTime() + 100),
          endTime: new Date(baseTime.getTime() + 1100),
          isEvent: false,
          isRootSpan: false,
          parentSpanId: 'agent-1',
          attributes: {
            model: 'gpt-4',
            resultType: 'tool_selection',
          } as ModelGenerationAttributes,
        },
        // Tool call based on LLM decision
        {
          id: 'tool-1',
          traceId: 'trace-1',
          name: 'search-kb',
          type: SpanType.TOOL_CALL,
          startTime: new Date(baseTime.getTime() + 1200),
          endTime: new Date(baseTime.getTime() + 2200),
          isEvent: false,
          isRootSpan: false,
          parentSpanId: 'agent-1',
          attributes: {
            toolId: 'knowledge_base_search',
            success: true,
          } as ToolCallAttributes,
        },
        // Second LLM call (response generation)
        {
          id: 'llm-2',
          traceId: 'trace-1',
          name: 'llm-response',
          type: SpanType.MODEL_GENERATION,
          startTime: new Date(baseTime.getTime() + 2300),
          endTime: new Date(baseTime.getTime() + 3300),
          isEvent: false,
          isRootSpan: false,
          parentSpanId: 'agent-1',
          attributes: {
            model: 'gpt-4',
            resultType: 'response_generation',
          } as ModelGenerationAttributes,
        },
      ];

      const results = spans.map(span => converter.convertSpan(span));

      // Verify hierarchy structure
      expect(results[0].parentSpanId).toBeUndefined(); // agent is root
      expect(results[1].parentSpanId).toBe('agent-1'); // llm-1 under agent
      expect(results[2].parentSpanId).toBe('agent-1'); // tool under agent
      expect(results[3].parentSpanId).toBe('agent-1'); // llm-2 under agent

      // Verify naming conventions are applied
      expect(results[0].name).toBe('agent.customer-support');
      expect(results[1].name).toBe('tool_selection gpt-4');
      expect(results[2].name).toBe('tool.execute knowledge_base_search');
      expect(results[3].name).toBe('chat gpt-4');

      // Verify all have same trace ID
      results.forEach(result => {
        expect(result.spanContext().traceId).toBe('trace-1');
      });
    });
  });

  describe('Orphaned Spans', () => {
    it('should handle spans with non-existent parent IDs', () => {
      const span: ExportedSpan<SpanType.TOOL_CALL> = {
        id: 'orphan-span',
        traceId: 'trace-1',
        name: 'tool',
        type: SpanType.TOOL_CALL,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        parentSpanId: 'non-existent-parent', // Parent doesn't exist
        attributes: {
          toolId: 'orphaned-tool',
        } as ToolCallAttributes,
      };

      const result = converter.convertSpan(span);

      // Should preserve the parent ID even if it doesn't exist
      // (OTEL collectors will handle orphaned spans)
      expect(result.parentSpanId).toBe('non-existent-parent');
    });
  });

  describe('Parallel Execution', () => {
    it('should handle multiple children of the same parent', () => {
      const rootSpan: ExportedSpan<SpanType.WORKFLOW_RUN> = {
        id: 'workflow-1',
        traceId: 'trace-1',
        name: 'workflow',
        type: SpanType.WORKFLOW_RUN,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: true,
        parentSpanId: undefined,
        attributes: {
          workflowId: 'parallel-workflow',
        } as WorkflowRunAttributes,
      };

      // Three parallel steps
      const parallelSteps = ['step-a', 'step-b', 'step-c'].map(
        stepId =>
          ({
            id: stepId,
            traceId: 'trace-1',
            name: stepId,
            type: SpanType.WORKFLOW_STEP,
            startTime: new Date(),
            endTime: new Date(),
            isEvent: false,
            isRootSpan: false,
            parentSpanId: 'workflow-1', // All have same parent
            attributes: {
              stepId,
            } as WorkflowStepAttributes,
          }) as ExportedSpan<SpanType.WORKFLOW_STEP>,
      );

      const rootResult = converter.convertSpan(rootSpan);
      const stepResults = parallelSteps.map(span => converter.convertSpan(span));

      // Root has no parent
      expect(rootResult.parentSpanId).toBeUndefined();

      // All steps have the workflow as parent
      stepResults.forEach(result => {
        expect(result.parentSpanId).toBe('workflow-1');
      });
    });
  });
});
