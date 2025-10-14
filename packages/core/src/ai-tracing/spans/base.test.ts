import { beforeEach, describe, expect, it } from 'vitest';

import { clearAITracingRegistry } from '../registry';
import { DefaultAITracing } from '../tracers';
import type { AITracingExporter, AITracingEvent } from '../types';
import { AISpanType, SamplingStrategyType } from '../types';

// Simple test exporter for capturing events
class TestExporter implements AITracingExporter {
  name = 'test-exporter';
  events: AITracingEvent[] = [];

  async exportEvent(event: AITracingEvent): Promise<void> {
    this.events.push(event);
  }

  async shutdown(): Promise<void> {
    this.events = [];
  }
}

describe('AISpan', () => {
  let testExporter: TestExporter;

  beforeEach(() => {
    clearAITracingRegistry();
    testExporter = new TestExporter();
  });

  describe('findParent', () => {
    it('should find parent span of specific type', () => {
      const tracing = new DefaultAITracing({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      // Create a hierarchy: AGENT_RUN -> WORKFLOW_RUN -> WORKFLOW_STEP -> LLM_GENERATION
      const agentSpan = tracing.startSpan({
        type: AISpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-123',
        },
      });

      const workflowSpan = agentSpan.createChildSpan({
        type: AISpanType.WORKFLOW_RUN,
        name: 'test-workflow',
        attributes: {
          workflowId: 'workflow-123',
        },
      });

      const stepSpan = workflowSpan.createChildSpan({
        type: AISpanType.WORKFLOW_STEP,
        name: 'test-step',
        attributes: {
          stepId: 'step-1',
        },
      });

      const llmSpan = stepSpan.createChildSpan({
        type: AISpanType.LLM_GENERATION,
        name: 'llm-call',
        attributes: {
          model: 'gpt-4',
        },
      });

      // From LLM span, find AGENT_RUN parent
      const foundAgentSpan = llmSpan.findParent(AISpanType.AGENT_RUN);
      expect(foundAgentSpan).toBeDefined();
      expect(foundAgentSpan?.id).toBe(agentSpan.id);
      expect(foundAgentSpan?.name).toBe('test-agent');

      // From LLM span, find WORKFLOW_RUN parent
      const foundWorkflowSpan = llmSpan.findParent(AISpanType.WORKFLOW_RUN);
      expect(foundWorkflowSpan).toBeDefined();
      expect(foundWorkflowSpan?.id).toBe(workflowSpan.id);
      expect(foundWorkflowSpan?.name).toBe('test-workflow');

      // From LLM span, find WORKFLOW_STEP parent
      const foundStepSpan = llmSpan.findParent(AISpanType.WORKFLOW_STEP);
      expect(foundStepSpan).toBeDefined();
      expect(foundStepSpan?.id).toBe(stepSpan.id);
      expect(foundStepSpan?.name).toBe('test-step');

      // From step span, find AGENT_RUN parent (should skip WORKFLOW_RUN)
      const foundAgentFromStep = stepSpan.findParent(AISpanType.AGENT_RUN);
      expect(foundAgentFromStep).toBeDefined();
      expect(foundAgentFromStep?.id).toBe(agentSpan.id);

      agentSpan.end();
    });

    it('should return undefined when parent type not found', () => {
      const tracing = new DefaultAITracing({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const agentSpan = tracing.startSpan({
        type: AISpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-123',
        },
      });

      const llmSpan = agentSpan.createChildSpan({
        type: AISpanType.LLM_GENERATION,
        name: 'llm-call',
        attributes: {
          model: 'gpt-4',
        },
      });

      // Try to find a WORKFLOW_RUN parent that doesn't exist
      const foundWorkflow = llmSpan.findParent(AISpanType.WORKFLOW_RUN);
      expect(foundWorkflow).toBeUndefined();

      // Try to find AGENT_RUN from root span (no parent)
      const foundAgent = agentSpan.findParent(AISpanType.AGENT_RUN);
      expect(foundAgent).toBeUndefined();

      agentSpan.end();
    });

    it('should handle deep hierarchies correctly', () => {
      const tracing = new DefaultAITracing({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      // Create a very deep hierarchy
      const agentSpan = tracing.startSpan({
        type: AISpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-123',
        },
      });

      const workflowSpan = agentSpan.createChildSpan({
        type: AISpanType.WORKFLOW_RUN,
        name: 'workflow',
        attributes: {
          workflowId: 'workflow-1',
        },
      });

      const stepSpan1 = workflowSpan.createChildSpan({
        type: AISpanType.WORKFLOW_STEP,
        name: 'step-1',
        attributes: {
          stepId: 'step-1',
        },
      });

      const stepSpan2 = stepSpan1.createChildSpan({
        type: AISpanType.WORKFLOW_STEP,
        name: 'step-2',
        attributes: {
          stepId: 'step-2',
        },
      });

      const toolSpan = stepSpan2.createChildSpan({
        type: AISpanType.TOOL_CALL,
        name: 'tool-call',
        attributes: {
          toolId: 'tool-1',
        },
      });

      const llmSpan = toolSpan.createChildSpan({
        type: AISpanType.LLM_GENERATION,
        name: 'llm-call',
        attributes: {
          model: 'gpt-4',
        },
      });

      // From deeply nested LLM span, find AGENT_RUN at the top
      const foundAgent = llmSpan.findParent(AISpanType.AGENT_RUN);
      expect(foundAgent).toBeDefined();
      expect(foundAgent?.id).toBe(agentSpan.id);

      // Find the first WORKFLOW_STEP (should be step-2, the immediate parent of TOOL_CALL)
      const foundStep = llmSpan.findParent(AISpanType.WORKFLOW_STEP);
      expect(foundStep).toBeDefined();
      expect(foundStep?.name).toBe('step-2');

      agentSpan.end();
    });
  });
});
