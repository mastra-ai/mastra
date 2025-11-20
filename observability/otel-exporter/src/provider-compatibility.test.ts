/**
 * Tests for provider-specific compatibility requirements
 */

import type {
  ExportedSpan,
  AgentRunAttributes,
  ModelGenerationAttributes,
  ToolCallAttributes,
} from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpanConverter } from './span-converter.js';

// Mock the Resource class
vi.mock('@opentelemetry/resources', async () => {
  return {
    Resource: class {
      attributes: Record<string, any>;
      constructor(attrs: Record<string, any>) {
        this.attributes = attrs;
      }
    },
  };
});

// Mock semantic attributes
vi.mock('@opentelemetry/semantic-conventions', () => ({
  SemanticResourceAttributes: {
    SERVICE_NAME: 'service.name',
    SERVICE_VERSION: 'service.version',
    TELEMETRY_SDK_NAME: 'telemetry.sdk.name',
  },
}));

describe('Provider Compatibility', () => {
  let converter: SpanConverter;
  let resource: any;

  beforeEach(() => {
    // Create resource with proper service name
    resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'test-service',
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
      [SemanticResourceAttributes.TELEMETRY_SDK_NAME]: '@mastra/otel-exporter',
    });
    converter = new SpanConverter(resource);
  });

  describe('New Relic Requirements', () => {
    it('should include service name in resource attributes', () => {
      const span: ExportedSpan<SpanType.AGENT_RUN> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'agent',
        type: SpanType.AGENT_RUN,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: true,
        parentSpanId: undefined,
        attributes: { agentId: 'test-agent' } as AgentRunAttributes,
      };

      const result = converter.convertSpan(span);

      // Resource should have service name
      expect(result.resource.attributes[SemanticResourceAttributes.SERVICE_NAME]).toBe('test-service');
      expect(result.resource.attributes[SemanticResourceAttributes.SERVICE_VERSION]).toBe('1.0.0');
    });

    it('should preserve parent-child relationships', () => {
      const rootSpan: ExportedSpan<SpanType.AGENT_RUN> = {
        id: 'root-span',
        traceId: 'trace-1',
        name: 'agent',
        type: SpanType.AGENT_RUN,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: true,
        parentSpanId: undefined,
        attributes: { agentId: 'test' } as AgentRunAttributes,
      };

      const childSpan: ExportedSpan<SpanType.MODEL_GENERATION> = {
        id: 'child-span',
        traceId: 'trace-1',
        name: 'llm',
        type: SpanType.MODEL_GENERATION,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        parentSpanId: 'root-span',
        attributes: { model: 'gpt-4' } as ModelGenerationAttributes,
      };

      const rootResult = converter.convertSpan(rootSpan);
      const childResult = converter.convertSpan(childSpan);

      expect(rootResult.parentSpanId).toBeUndefined();
      expect(childResult.parentSpanId).toBe('root-span');
    });
  });

  describe('Laminar Requirements', () => {
    it('should include both generic and specific input/output attributes', () => {
      const span: ExportedSpan<SpanType.MODEL_GENERATION> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'llm',
        type: SpanType.MODEL_GENERATION,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        parentSpanId: 'parent',
        input: { messages: [{ role: 'user', content: 'Hello' }] },
        output: { content: 'Hi there!' },
        attributes: {
          model: 'gpt-4',
        } as ModelGenerationAttributes,
      };

      const result = converter.convertSpan(span);

      // Should have generic input/output for Laminar
      expect(result.attributes['input']).toBeDefined();
      expect(result.attributes['output']).toBeDefined();

      // Should also have OTEL-specific attributes
      expect(result.attributes['gen_ai.prompt']).toBeDefined();
      expect(result.attributes['gen_ai.completion']).toBeDefined();
    });

    it('should handle tool input/output', () => {
      const span: ExportedSpan<SpanType.TOOL_CALL> = {
        id: 'tool-1',
        traceId: 'trace-1',
        name: 'tool',
        type: SpanType.TOOL_CALL,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        parentSpanId: 'parent',
        input: { query: 'search term' },
        output: { results: ['result1', 'result2'] },
        attributes: {
          toolId: 'search',
        } as ToolCallAttributes,
      };

      const result = converter.convertSpan(span);

      // Should have both generic and tool-specific attributes
      expect(result.attributes['input']).toBeDefined();
      expect(result.attributes['output']).toBeDefined();
      expect(result.attributes['gen_ai.tool.input']).toBeDefined();
      expect(result.attributes['gen_ai.tool.output']).toBeDefined();
    });
  });

  describe('Traceloop/SigNoz Requirements', () => {
    it('should maintain trace context across all spans', () => {
      const traceId = 'consistent-trace-id';
      const spans: ExportedSpan<any>[] = [
        {
          id: 'span-1',
          traceId,
          name: 'root',
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
          name: 'child1',
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
          name: 'child2',
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

      // All spans should have same trace ID
      results.forEach(result => {
        expect(result.spanContext().traceId).toBe(traceId);
      });

      // Parent relationships should be preserved
      expect(results[0].parentSpanId).toBeUndefined();
      expect(results[1].parentSpanId).toBe('span-1');
      expect(results[2].parentSpanId).toBe('span-1');
    });

    it('should use OTEL-compliant span names', () => {
      const llmSpan: ExportedSpan<SpanType.MODEL_GENERATION> = {
        id: 'llm-1',
        traceId: 'trace-1',
        name: 'original-name',
        type: SpanType.MODEL_GENERATION,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        parentSpanId: 'parent',
        attributes: {
          model: 'claude-3',
          resultType: 'response_generation',
        } as ModelGenerationAttributes,
      };

      const toolSpan: ExportedSpan<SpanType.TOOL_CALL> = {
        id: 'tool-1',
        traceId: 'trace-1',
        name: 'original-tool',
        type: SpanType.TOOL_CALL,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        parentSpanId: 'parent',
        attributes: {
          toolId: 'calculator',
        } as ToolCallAttributes,
      };

      const llmResult = converter.convertSpan(llmSpan);
      const toolResult = converter.convertSpan(toolSpan);

      // Check OTEL-compliant names
      expect(llmResult.name).toBe('chat claude-3');
      expect(toolResult.name).toBe('tool.execute calculator');
    });
  });

  describe('Common Requirements', () => {
    it('should include all OTEL semantic conventions', () => {
      const span: ExportedSpan<SpanType.MODEL_GENERATION> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'llm',
        type: SpanType.MODEL_GENERATION,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        parentSpanId: 'parent',
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
          },
          parameters: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          },
        } as ModelGenerationAttributes,
      };

      const result = converter.convertSpan(span);

      // Check OTEL semantic conventions
      expect(result.attributes['gen_ai.operation.name']).toBe('chat');
      expect(result.attributes['gen_ai.request.model']).toBe('gpt-4');
      expect(result.attributes['gen_ai.system']).toBe('openai');
      expect(result.attributes['gen_ai.usage.input_tokens']).toBe(100);
      expect(result.attributes['gen_ai.usage.output_tokens']).toBe(50);
      expect(result.attributes['gen_ai.usage.total_tokens']).toBe(150);
      expect(result.attributes['gen_ai.request.temperature']).toBe(0.7);
      expect(result.attributes['gen_ai.request.max_tokens']).toBe(1000);
    });

    it('should include debugging attributes', () => {
      const span: ExportedSpan<SpanType.AGENT_RUN> = {
        id: 'unique-span-id',
        traceId: 'unique-trace-id',
        name: 'agent',
        type: SpanType.AGENT_RUN,
        startTime: new Date('2024-01-01T12:00:00Z'),
        endTime: new Date('2024-01-01T12:00:05Z'),
        isEvent: false,
        isRootSpan: true,
        parentSpanId: undefined,
        attributes: { agentId: 'test' } as AgentRunAttributes,
      };

      const result = converter.convertSpan(span);

      // Check debugging attributes
      expect(result.attributes['mastra.span.type']).toBe(SpanType.AGENT_RUN);
      expect(result.attributes['mastra.trace_id']).toBe('unique-trace-id');
      expect(result.attributes['mastra.span_id']).toBe('unique-span-id');
      expect(result.attributes['mastra.start_time']).toBeDefined();
      expect(result.attributes['mastra.end_time']).toBeDefined();
      expect(result.attributes['mastra.duration_ms']).toBe(5000);
    });

    it('should handle metadata properly', () => {
      const span: ExportedSpan<SpanType.AGENT_RUN> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'agent',
        type: SpanType.AGENT_RUN,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: true,
        parentSpanId: undefined,
        metadata: {
          custom_field: 'value',
          nested_object: { key: 'value' },
          null_value: null,
          undefined_value: undefined,
        },
        attributes: { agentId: 'test' } as AgentRunAttributes,
      };

      const result = converter.convertSpan(span);

      // Check metadata handling
      expect(result.attributes['custom_field']).toBe('value');
      expect(result.attributes['nested_object']).toBe('{"key":"value"}');
      expect(result.attributes['null_value']).toBeUndefined();
      expect(result.attributes['undefined_value']).toBeUndefined();
    });
  });
});
