import type { ObservabilityExporter, TracingEvent } from '@mastra/core/observability';
import { SpanType, SamplingStrategyType, InternalSpans } from '@mastra/core/observability';
import { beforeEach, describe, expect, it } from 'vitest';

import { DefaultObservabilityInstance } from '../instances';
import { getExternalParentId } from './base';
import { deepClean, DEFAULT_DEEP_CLEAN_OPTIONS, isSerializedMap, reconstructSerializedMap } from './serialization';

// Simple test exporter for capturing events
class TestExporter implements ObservabilityExporter {
  name = 'test-exporter';
  events: TracingEvent[] = [];

  async exportTracingEvent(event: TracingEvent): Promise<void> {
    this.events.push(event);
  }

  async shutdown(): Promise<void> {
    this.events = [];
  }
}

describe('Span', () => {
  let testExporter: TestExporter;

  beforeEach(() => {
    testExporter = new TestExporter();
  });

  describe('findParent', () => {
    it('should find parent span of specific type', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      // Create a hierarchy: AGENT_RUN -> WORKFLOW_RUN -> WORKFLOW_STEP -> MODEL_GENERATION
      const agentSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-123',
        },
      });

      const workflowSpan = agentSpan.createChildSpan({
        type: SpanType.WORKFLOW_RUN,
        name: 'test-workflow',
        attributes: {
          workflowId: 'workflow-123',
        },
      });

      const stepSpan = workflowSpan.createChildSpan({
        type: SpanType.WORKFLOW_STEP,
        name: 'test-step',
        attributes: {
          stepId: 'step-1',
        },
      });

      const llmSpan = stepSpan.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'llm-call',
        attributes: {
          model: 'gpt-4',
        },
      });

      // From LLM span, find AGENT_RUN parent
      const foundAgentSpan = llmSpan.findParent(SpanType.AGENT_RUN);
      expect(foundAgentSpan).toBeDefined();
      expect(foundAgentSpan?.id).toBe(agentSpan.id);
      expect(foundAgentSpan?.name).toBe('test-agent');

      // From LLM span, find WORKFLOW_RUN parent
      const foundWorkflowSpan = llmSpan.findParent(SpanType.WORKFLOW_RUN);
      expect(foundWorkflowSpan).toBeDefined();
      expect(foundWorkflowSpan?.id).toBe(workflowSpan.id);
      expect(foundWorkflowSpan?.name).toBe('test-workflow');

      // From LLM span, find WORKFLOW_STEP parent
      const foundStepSpan = llmSpan.findParent(SpanType.WORKFLOW_STEP);
      expect(foundStepSpan).toBeDefined();
      expect(foundStepSpan?.id).toBe(stepSpan.id);
      expect(foundStepSpan?.name).toBe('test-step');

      // From step span, find AGENT_RUN parent (should skip WORKFLOW_RUN)
      const foundAgentFromStep = stepSpan.findParent(SpanType.AGENT_RUN);
      expect(foundAgentFromStep).toBeDefined();
      expect(foundAgentFromStep?.id).toBe(agentSpan.id);

      agentSpan.end();
    });

    it('should return undefined when parent type not found', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const agentSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-123',
        },
      });

      const llmSpan = agentSpan.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'llm-call',
        attributes: {
          model: 'gpt-4',
        },
      });

      // Try to find a WORKFLOW_RUN parent that doesn't exist
      const foundWorkflow = llmSpan.findParent(SpanType.WORKFLOW_RUN);
      expect(foundWorkflow).toBeUndefined();

      // Try to find AGENT_RUN from root span (no parent)
      const foundAgent = agentSpan.findParent(SpanType.AGENT_RUN);
      expect(foundAgent).toBeUndefined();

      agentSpan.end();
    });

    it('should handle deep hierarchies correctly', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      // Create a very deep hierarchy
      const agentSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-123',
        },
      });

      const workflowSpan = agentSpan.createChildSpan({
        type: SpanType.WORKFLOW_RUN,
        name: 'workflow',
        attributes: {
          workflowId: 'workflow-1',
        },
      });

      const stepSpan1 = workflowSpan.createChildSpan({
        type: SpanType.WORKFLOW_STEP,
        name: 'step-1',
        attributes: {
          stepId: 'step-1',
        },
      });

      const stepSpan2 = stepSpan1.createChildSpan({
        type: SpanType.WORKFLOW_STEP,
        name: 'step-2',
        attributes: {
          stepId: 'step-2',
        },
      });

      const toolSpan = stepSpan2.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'tool-call',
        attributes: {
          toolId: 'tool-1',
        },
      });

      const llmSpan = toolSpan.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'llm-call',
        attributes: {
          model: 'gpt-4',
        },
      });

      // From deeply nested LLM span, find AGENT_RUN at the top
      const foundAgent = llmSpan.findParent(SpanType.AGENT_RUN);
      expect(foundAgent).toBeDefined();
      expect(foundAgent?.id).toBe(agentSpan.id);

      // Find the first WORKFLOW_STEP (should be step-2, the immediate parent of TOOL_CALL)
      const foundStep = llmSpan.findParent(SpanType.WORKFLOW_STEP);
      expect(foundStep).toBeDefined();
      expect(foundStep?.name).toBe('step-2');

      agentSpan.end();
    });
  });

  describe('entity inheritance', () => {
    it('should inherit entityId and entityName from parent span when not explicitly provided', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const agentSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        entityId: 'agent-123',
        entityName: 'MyAgent',
        attributes: {},
      });

      const llmSpan = agentSpan.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'llm-call',
        attributes: { model: 'gpt-4' },
      });

      // MODEL_GENERATION should inherit entityId and entityName from AGENT_RUN
      expect(llmSpan.entityId).toBe('agent-123');
      expect(llmSpan.entityName).toBe('MyAgent');

      agentSpan.end();
    });

    it('should allow child span to override inherited entityId and entityName', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const agentSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        entityId: 'agent-123',
        entityName: 'MyAgent',
        attributes: {},
      });

      const toolSpan = agentSpan.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'tool-call',
        entityId: 'tool-456',
        entityName: 'MyTool',
        attributes: {},
      });

      // TOOL_CALL should use its own entityId and entityName
      expect(toolSpan.entityId).toBe('tool-456');
      expect(toolSpan.entityName).toBe('MyTool');

      agentSpan.end();
    });
  });

  describe('metadata inheritance', () => {
    it('should inherit metadata from parent span when not explicitly provided', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const agentSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        metadata: { userId: 'user-123', sessionId: 'session-456' },
        attributes: {},
      });

      const llmSpan = agentSpan.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'llm-call',
        attributes: { model: 'gpt-4' },
      });

      // MODEL_GENERATION should inherit metadata from AGENT_RUN
      expect(llmSpan.metadata).toEqual({ userId: 'user-123', sessionId: 'session-456' });

      agentSpan.end();
    });

    it('should allow child span to override inherited metadata', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const agentSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        metadata: { userId: 'user-123', priority: 'low' },
        attributes: {},
      });

      const toolSpan = agentSpan.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'tool-call',
        metadata: { priority: 'high' },
        attributes: {},
      });

      // TOOL_CALL should have merged metadata with its own value taking precedence
      expect(toolSpan.metadata).toEqual({ userId: 'user-123', priority: 'high' });

      agentSpan.end();
    });

    it('should merge parent and child metadata', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const agentSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        metadata: { userId: 'user-123' },
        attributes: {},
      });

      const llmSpan = agentSpan.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'llm-call',
        metadata: { requestId: 'req-789' },
        attributes: { model: 'gpt-4' },
      });

      // Should have both parent and child metadata merged
      expect(llmSpan.metadata).toEqual({ userId: 'user-123', requestId: 'req-789' });

      agentSpan.end();
    });

    it('should propagate metadata through multiple levels', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const agentSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        metadata: { userId: 'user-123' },
        attributes: {},
      });

      const workflowSpan = agentSpan.createChildSpan({
        type: SpanType.WORKFLOW_RUN,
        name: 'workflow',
        attributes: {},
      });

      const llmSpan = workflowSpan.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'llm-call',
        attributes: { model: 'gpt-4' },
      });

      expect(llmSpan.metadata).toEqual({ userId: 'user-123' });

      agentSpan.end();
    });
  });

  describe('getExternalParentId', () => {
    it('should return undefined when no parent', () => {
      const options = {
        type: SpanType.AGENT_RUN,
        name: 'test',
        attributes: { agentId: 'agent-1' },
      };

      expect(getExternalParentId(options)).toBeUndefined();
    });

    it('should return parent ID when parent is external', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const parent = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'parent-span',
        attributes: { agentId: 'agent-1' },
        tracingPolicy: {
          internal: InternalSpans.NONE, // All spans external
        },
      });

      const options = {
        type: SpanType.MODEL_GENERATION,
        name: 'test',
        attributes: { model: 'gpt-4' },
        parent,
      };

      expect(getExternalParentId(options)).toBe(parent.id);

      parent.end();
    });

    it('should return grandparent ID when parent is internal', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      // Create external grandparent
      const grandparent = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'agent',
        attributes: { agentId: 'agent-1' },
        tracingPolicy: {
          internal: InternalSpans.NONE,
        },
      });

      // Create internal parent
      const parent = grandparent.createChildSpan({
        type: SpanType.WORKFLOW_STEP,
        name: 'workflow-step',
        attributes: { stepId: 'step-1' },
        tracingPolicy: {
          internal: InternalSpans.WORKFLOW, // Workflow spans are internal
        },
      });

      expect(parent.isInternal).toBe(true);

      const options = {
        type: SpanType.MODEL_GENERATION,
        name: 'llm-call',
        attributes: { model: 'gpt-4' },
        parent,
      };

      // Should skip internal parent and return grandparent ID
      expect(getExternalParentId(options)).toBe(grandparent.id);

      grandparent.end();
    });

    it('should skip multiple internal ancestors', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      // Create external great-grandparent
      const greatGrandparent = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'agent',
        attributes: { agentId: 'agent-1' },
        tracingPolicy: {
          internal: InternalSpans.NONE,
        },
      });

      // Create internal grandparent
      const grandparent = greatGrandparent.createChildSpan({
        type: SpanType.WORKFLOW_RUN,
        name: 'workflow',
        attributes: { workflowId: 'workflow-1' },
        tracingPolicy: {
          internal: InternalSpans.WORKFLOW,
        },
      });

      // Create internal parent
      const parent = grandparent.createChildSpan({
        type: SpanType.WORKFLOW_STEP,
        name: 'workflow-step',
        attributes: { stepId: 'step-1' },
        tracingPolicy: {
          internal: InternalSpans.WORKFLOW,
        },
      });

      expect(grandparent.isInternal).toBe(true);
      expect(parent.isInternal).toBe(true);

      const options = {
        type: SpanType.MODEL_GENERATION,
        name: 'llm-call',
        attributes: { model: 'gpt-4' },
        parent,
      };

      // Should skip both internal ancestors and return great-grandparent ID
      expect(getExternalParentId(options)).toBe(greatGrandparent.id);

      greatGrandparent.end();
    });

    it('should return undefined when all ancestors are internal (no external parent)', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      // Create internal root (unusual, but possible)
      const grandparent = tracing.startSpan({
        type: SpanType.WORKFLOW_RUN,
        name: 'workflow',
        attributes: { workflowId: 'workflow-1' },
        tracingPolicy: {
          internal: InternalSpans.WORKFLOW,
        },
      });

      const parent = grandparent.createChildSpan({
        type: SpanType.WORKFLOW_STEP,
        name: 'workflow-step',
        attributes: { stepId: 'step-1' },
        tracingPolicy: {
          internal: InternalSpans.WORKFLOW,
        },
      });

      expect(grandparent.isInternal).toBe(true);
      expect(parent.isInternal).toBe(true);

      const options = {
        type: SpanType.MODEL_GENERATION,
        name: 'llm-call',
        attributes: { model: 'gpt-4' },
        parent,
      };

      // No external ancestor exists
      expect(getExternalParentId(options)).toBeUndefined();

      grandparent.end();
    });

    it('should handle mixed internal/external hierarchy correctly', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      // External -> Internal -> Internal -> External -> Internal
      const agentSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'agent',
        attributes: { agentId: 'agent-1' },
        tracingPolicy: {
          internal: InternalSpans.NONE,
        },
      });

      const workflowSpan = agentSpan.createChildSpan({
        type: SpanType.WORKFLOW_RUN,
        name: 'workflow',
        attributes: { workflowId: 'workflow-1' },
        tracingPolicy: {
          internal: InternalSpans.WORKFLOW,
        },
      });

      const stepSpan = workflowSpan.createChildSpan({
        type: SpanType.WORKFLOW_STEP,
        name: 'step',
        attributes: { stepId: 'step-1' },
        tracingPolicy: {
          internal: InternalSpans.WORKFLOW,
        },
      });

      const llmSpan = stepSpan.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'llm-call',
        attributes: { model: 'gpt-4' },
        tracingPolicy: {
          internal: InternalSpans.NONE,
        },
      });

      const toolSpan = llmSpan.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'tool-call',
        attributes: { toolId: 'tool-1' },
        tracingPolicy: {
          internal: InternalSpans.TOOL,
        },
      });

      expect(agentSpan.isInternal).toBe(false);
      expect(workflowSpan.isInternal).toBe(true);
      expect(stepSpan.isInternal).toBe(true);
      expect(llmSpan.isInternal).toBe(false);
      expect(toolSpan.isInternal).toBe(true);

      // From toolSpan (internal), should return llmSpan (external parent)
      const options = {
        type: SpanType.MODEL_GENERATION,
        name: 'another-llm',
        attributes: { model: 'gpt-4' },
        parent: toolSpan,
      };

      expect(getExternalParentId(options)).toBe(llmSpan.id);

      agentSpan.end();
    });
  });

  describe('deepClean', () => {
    it('should preserve Date objects as-is', () => {
      const date = new Date('2024-01-15T12:30:00.000Z');
      const nestedDate = new Date('2024-06-20T08:00:00.000Z');
      const input = {
        name: 'test',
        createdAt: date,
        nested: {
          updatedAt: nestedDate,
        },
      };

      const result = deepClean(input);

      expect(result.name).toBe('test');
      expect(result.createdAt).toBe(date);
      expect(result.createdAt instanceof Date).toBe(true);
      expect(result.nested.updatedAt).toBe(nestedDate);
      expect(result.nested.updatedAt instanceof Date).toBe(true);
    });

    it('should handle Date objects in arrays', () => {
      const date1 = new Date('2024-01-01T00:00:00.000Z');
      const date2 = new Date('2024-12-31T23:59:59.000Z');
      const input = {
        dates: [date1, date2],
      };

      const result = deepClean(input);

      expect(result.dates[0]).toBe(date1);
      expect(result.dates[1]).toBe(date2);
    });

    it('should handle circular references', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;

      const result = deepClean(obj);

      expect(result.name).toBe('test');
      expect(result.self).toBe('[Circular]');
    });

    it('should strip specified keys', () => {
      const input = {
        name: 'test',
        logger: { level: 'info' },
        tracingContext: { traceId: '123' },
        data: 'keep this',
      };

      const result = deepClean(input);

      expect(result.name).toBe('test');
      expect(result.data).toBe('keep this');
      expect(result.logger).toBeUndefined();
      expect(result.tracingContext).toBeUndefined();
    });

    it("should honor an object's serializeForSpan() method so private fields are not walked", () => {
      class FakeModel {
        modelId = 'gpt-4o';
        provider = 'openai';
        // TypeScript-private fields are enumerable at runtime; serializeForSpan
        // gives classes a hook to opt out of having them walked.
        private config = { apiKey: 'sk-leak-me', headers: { Authorization: 'Bearer x' } };
        private gateway = { name: 'proxy', apiKey: 'gateway-secret' };

        serializeForSpan() {
          return { modelId: this.modelId, provider: this.provider };
        }
      }

      const input = { model: new FakeModel() };
      const result = deepClean(input);

      expect(result.model).toEqual({ modelId: 'gpt-4o', provider: 'openai' });
      expect(JSON.stringify(result)).not.toContain('sk-leak-me');
      expect(JSON.stringify(result)).not.toContain('gateway-secret');
      expect(JSON.stringify(result)).not.toContain('Bearer x');
    });

    it('should handle keysToStrip as a plain object (bundler compatibility)', () => {
      const input = { name: 'test', logger: { level: 'info' }, tracingContext: { traceId: '123' }, data: 'keep' };
      const options = {
        ...DEFAULT_DEEP_CLEAN_OPTIONS,
        keysToStrip: { logger: true, tracingContext: true },
      };
      const result = deepClean(input, options);
      expect(result.name).toBe('test');
      expect(result.data).toBe('keep');
      expect(result.logger).toBeUndefined();
      expect(result.tracingContext).toBeUndefined();
    });

    it('should handle keysToStrip as an array (bundler compatibility)', () => {
      const input = { name: 'test', logger: { level: 'info' }, tracingContext: { traceId: '123' }, data: 'keep' };
      const options = {
        ...DEFAULT_DEEP_CLEAN_OPTIONS,
        keysToStrip: ['logger', 'tracingContext'],
      };
      const result = deepClean(input, options);
      expect(result.name).toBe('test');
      expect(result.data).toBe('keep');
      expect(result.logger).toBeUndefined();
      expect(result.tracingContext).toBeUndefined();
    });

    it('should preserve shared (non-circular) object references', () => {
      // Simulate the tool-invocations scenario from issue #14262:
      // toolInvocations[0] and parts[0].toolInvocation point to the SAME object.
      const toolData = { args: { query: 'search term' }, result: { pages: [{ url: 'https://example.com' }] } };
      const message = {
        content: {
          toolInvocations: [toolData],
          parts: [{ type: 'tool-invocation', toolInvocation: toolData }],
        },
      };

      const result = deepClean(message);

      // Both locations should have the full data — no [Circular]
      expect(result.content.toolInvocations[0].args.query).toBe('search term');
      expect(result.content.toolInvocations[0].result.pages[0].url).toBe('https://example.com');
      expect(result.content.parts[0].toolInvocation.args.query).toBe('search term');
      expect(result.content.parts[0].toolInvocation.result.pages[0].url).toBe('https://example.com');
    });

    it('should still detect true circular references', () => {
      const a: any = { name: 'a' };
      const b: any = { name: 'b', parent: a };
      a.child = b; // true cycle: a → b → a

      const result = deepClean(a);
      expect(result.name).toBe('a');
      expect(result.child.name).toBe('b');
      expect(result.child.parent).toBe('[Circular]');
    });

    it('should serialize nested objects within default depth limit', () => {
      // 6-level deep object — comfortably within maxDepth=8
      const payload: any = { level: 0 };
      let current = payload;
      for (let i = 1; i <= 6; i++) {
        current.nested = { level: i, data: `value-${i}` };
        current = current.nested;
      }

      const result = deepClean(payload);

      let node = result;
      for (let i = 0; i <= 5; i++) {
        expect(node.level).toBe(i);
        node = node.nested;
      }
      expect(node.level).toBe(6);
      expect(node.data).toBe('value-6');
    });

    it('should handle max depth', () => {
      const deepObj: any = { level: 0 };
      let current = deepObj;
      for (let i = 1; i <= 15; i++) {
        current.nested = { level: i };
        current = current.nested;
      }

      const result = deepClean(deepObj, { ...DEFAULT_DEEP_CLEAN_OPTIONS, maxDepth: 3 });

      expect(result.level).toBe(0);
      expect(result.nested.level).toBe(1);
      expect(result.nested.nested.level).toBe(2);
      // At depth 3, each property value is replaced with [MaxDepth]
      expect(result.nested.nested.nested).toEqual({
        level: '[MaxDepth]',
        nested: '[MaxDepth]',
      });
    });

    it('should preserve JSON schemas as-is instead of compressing them', () => {
      const schema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        oneOf: [{ type: 'string' }, { type: 'number' }],
      };

      const result = deepClean(schema);

      expect(result).toEqual({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        oneOf: [{ type: 'string' }, { type: 'number' }],
      });
    });

    it('should preserve tool parameter JSON schemas with full type information', () => {
      const schema = {
        type: 'object',
        properties: {
          query: {
            type: 'object',
            properties: {
              what: { type: 'string' },
              where: { type: 'string' },
            },
            required: ['what', 'where'],
          },
        },
        required: ['query'],
        $schema: 'http://json-schema.org/draft-07/schema#',
      };

      const result = deepClean(schema);

      expect(result).toEqual(schema);
    });

    it('should not abort when array element getters throw', () => {
      const items = ['safe'];
      Object.defineProperty(items, 1, {
        enumerable: true,
        get() {
          throw new Error('array getter failed');
        },
      });
      items.length = 2;

      const result = deepClean({ items });

      expect(result.items).toEqual(['safe', '[array getter failed]']);
    });

    it('should return a safe placeholder when serializeForSpan access throws', () => {
      const input = {
        secret: 'should-not-leak',
        get serializeForSpan() {
          throw new Error('probe failed');
        },
      };

      const result = deepClean(input);

      expect(result).toBe('[serializeForSpan failed: probe failed]');
    });

    it('should handle objects with throwing getter properties gracefully', () => {
      const input: Record<string, unknown> = {
        type: 'object',
        properties: { safe: { type: 'string' } },
      };

      Object.defineProperty(input, '$schema', {
        enumerable: true,
        get() {
          throw new Error('schema getter failed');
        },
      });

      const result = deepClean(input);

      expect(result.type).toBe('object');
      expect(result.properties.safe.type).toBe('string');
      expect(result.$schema).toBe('[schema getter failed]');
    });

    it('should serialize Maps including nested and primitive/object values', () => {
      const inner = new Map<string, any>([['k', 'v']]);
      const map = new Map<any, any>([
        ['a', 1],
        ['b', { x: 'y' }],
        [42, 'num-key'],
        ['inner', inner],
      ]);

      const result = deepClean({ map });

      expect(result.map).toEqual({
        __type: 'Map',
        __map_entries: [
          ['string', 'a', 1],
          ['string', 'b', { x: 'y' }],
          ['number', 42, 'num-key'],
          ['string', 'inner', { __type: 'Map', __map_entries: [['string', 'k', 'v']] }],
        ],
      });
      expect(() => JSON.stringify(result)).not.toThrow();
    });

    it('should preserve distinct Map key identities and allow reconstruction', () => {
      const map = new Map<any, any>([
        [1, 'number-key'],
        ['1', 'string-key'],
      ]);

      const result = deepClean({ map });

      expect(isSerializedMap(result.map)).toBe(true);
      expect(result.map.__map_entries).toEqual([
        ['number', 1, 'number-key'],
        ['string', '1', 'string-key'],
      ]);

      const reconstructed = reconstructSerializedMap(result.map);
      expect(reconstructed.get(1)).toBe('number-key');
      expect(reconstructed.get('1')).toBe('string-key');
    });

    it('should detect self-referential Maps', () => {
      const map = new Map<string, any>();
      map.set('self', map);
      map.set('ok', 1);

      const result = deepClean({ map });

      expect(result.map.__map_entries).toEqual([
        ['string', 'self', '[Circular]'],
        ['string', 'ok', 1],
      ]);
    });

    it('should truncate Maps that exceed maxObjectKeys', () => {
      const map = new Map<string, number>();
      for (let i = 0; i < 5; i++) map.set(`k${i}`, i);

      const result = deepClean({ map }, { ...DEFAULT_DEEP_CLEAN_OPTIONS, maxObjectKeys: 2 });

      expect(result.map.__map_entries).toHaveLength(2);
      expect(result.map.__truncated).toBe('3 more keys omitted');
    });

    it('should strip matching string Map keys before truncation', () => {
      const map = new Map<any, any>([
        ['logger', 'omit'],
        ['visible', 1],
        [2, 'keep-number-key'],
      ]);

      const result = deepClean({ map });

      expect(result.map.__map_entries).toEqual([
        ['string', 'visible', 1],
        ['number', 2, 'keep-number-key'],
      ]);
    });

    it('should serialize Sets including nested and object items', () => {
      const inner = new Set([1, 2]);
      const set = new Set<any>([1, 'two', { a: 1 }, inner]);

      const result = deepClean({ set });

      expect(Array.isArray(result.set)).toBe(true);
      expect(result.set).toEqual([1, 'two', { a: 1 }, [1, 2]]);
      expect(() => JSON.stringify(result)).not.toThrow();
    });

    it('should detect self-referential Sets', () => {
      const set = new Set<any>();
      set.add(1);
      set.add(set);

      const result = deepClean({ set });

      expect(result.set[0]).toBe(1);
      expect(result.set[1]).toBe('[Circular]');
    });

    it('should truncate Sets that exceed maxArrayLength', () => {
      const set = new Set([1, 2, 3, 4, 5]);

      const result = deepClean({ set }, { ...DEFAULT_DEEP_CLEAN_OPTIONS, maxArrayLength: 2 });

      expect(result.set.slice(0, 2)).toEqual([1, 2]);
      expect(result.set[2]).toBe('[…3 more items]');
    });

    it('should preserve Error stack and cause', () => {
      const cause = new Error('root cause');
      const err = new Error('outer', { cause });

      const result = deepClean({ err });

      expect(result.err.name).toBe('Error');
      expect(result.err.message).toBe('outer');
      expect(typeof result.err.stack).toBe('string');
      expect(result.err.cause.name).toBe('Error');
      expect(result.err.cause.message).toBe('root cause');
      expect(typeof result.err.cause.stack).toBe('string');
      expect(() => JSON.stringify(result)).not.toThrow();
    });

    it('should detect Error cause cycles', () => {
      const err: any = new Error('cyclic');
      err.cause = err;

      const result = deepClean({ err });

      expect(result.err.name).toBe('Error');
      expect(result.err.message).toBe('cyclic');
      expect(result.err.cause).toBe('[Circular]');
      expect(() => JSON.stringify(result)).not.toThrow();
    });

    it('should guard Error property getters that throw', () => {
      const err = new Error('outer');

      Object.defineProperty(err, 'name', {
        configurable: true,
        get() {
          throw new Error('name getter failed');
        },
      });
      Object.defineProperty(err, 'message', {
        configurable: true,
        get() {
          throw new Error('message getter failed');
        },
      });
      Object.defineProperty(err, 'stack', {
        configurable: true,
        get() {
          throw new Error('stack getter failed');
        },
      });
      Object.defineProperty(err, 'cause', {
        configurable: true,
        get() {
          throw new Error('cause getter failed');
        },
      });

      const result = deepClean({ err });

      expect(result.err.name).toBe('[name getter failed]');
      expect(result.err.message).toBe('[message getter failed]');
      expect(result.err.stack).toBe('[stack getter failed]');
      expect(result.err.cause).toBe('[cause getter failed]');
      expect(() => JSON.stringify(result)).not.toThrow();
    });
  });

  describe('serializationOptions', () => {
    it('should use custom maxStringLength from config', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test',
        name: 'test',
        exporters: [testExporter],
        serializationOptions: {
          maxStringLength: 10,
        },
      });

      const longString = 'a'.repeat(100);
      const span = tracing.startSpan({
        type: SpanType.GENERIC,
        name: 'test',
        input: { data: longString },
      });

      // String should be truncated to 10 chars + truncation marker
      expect(span.input.data.length).toBeLessThanOrEqual(25);
      expect(span.input.data).toContain('[truncated]');
      span.end();
    });

    it('should use default options when serializationOptions is not provided', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test',
        name: 'test',
        exporters: [testExporter],
      });

      // Default maxStringLength is 128KB - create a string longer than that
      const longString = 'a'.repeat(150 * 1024);
      const span = tracing.startSpan({
        type: SpanType.GENERIC,
        name: 'test',
        input: { data: longString },
      });

      // Default maxStringLength is 128 * 1024 (128KB)
      expect(span.input.data.length).toBeLessThanOrEqual(128 * 1024 + 15);
      expect(span.input.data).toContain('[truncated]');
      span.end();
    });

    it('should respect custom maxDepth from config', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test',
        name: 'test',
        exporters: [testExporter],
        serializationOptions: {
          maxDepth: 2,
        },
      });

      const deepObj: any = { level: 0, nested: { level: 1, nested: { level: 2, nested: { level: 3 } } } };
      const span = tracing.startSpan({
        type: SpanType.GENERIC,
        name: 'test',
        input: deepObj,
      });

      // At maxDepth 2, level 2 values should be [MaxDepth]
      expect(span.input.level).toBe(0);
      expect(span.input.nested.level).toBe(1);
      expect(span.input.nested.nested.level).toBe('[MaxDepth]');
      span.end();
    });
  });
});
