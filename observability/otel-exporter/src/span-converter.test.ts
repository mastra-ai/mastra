/**
 * Tests for OTEL-compliant span conversion
 */

import { SpanType } from '@mastra/core/observability';
import type {
  ExportedSpan,
  ModelGenerationAttributes,
  AgentRunAttributes,
  ToolCallAttributes,
  MCPToolCallAttributes,
  WorkflowRunAttributes,
  WorkflowStepAttributes,
} from '@mastra/core/observability';
import { SpanKind } from '@opentelemetry/api';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
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
    resourceFromAttributes: (attrs: Record<string, any>) => ({
      attributes: attrs,
      merge: (other: { attributes: Record<string, any> }) => ({
        attributes: { ...attrs, ...other.attributes },
      }),
    }),
  };
});

describe('SpanConverter', () => {
  let converter: SpanConverter;

  beforeEach(() => {
    converter = new SpanConverter({
      packageName: '@mastra/otel-exporter',
      serviceName: 'test-service',
      format: 'GenAI_v1_38_0',
    });
  });

  // =============================================================================
  // SPAN NAMING CONVENTIONS
  // =============================================================================
  describe('Span Naming Conventions', () => {
    it('should format LLM generation span names correctly', async () => {
      const span: ExportedSpan<SpanType.MODEL_GENERATION> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'original-name',
        type: SpanType.MODEL_GENERATION,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          resultType: 'response_generation',
        } as ModelGenerationAttributes,
      };

      const result = await converter.convertSpan(span);
      expect(result.name).toBe('chat gpt-4');
    });

    it('should format tool call span names correctly', async () => {
      const span: ExportedSpan<SpanType.TOOL_CALL> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'original-name',
        type: SpanType.TOOL_CALL,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        entityId: 'get_weather',
        attributes: {
          toolId: 'get_weather',
          toolDescription: 'Gets weather data',
        } as ToolCallAttributes,
      };

      const result = await converter.convertSpan(span);
      expect(result.name).toBe('execute_tool get_weather');
    });

    it('should format agent span names correctly', async () => {
      const span: ExportedSpan<SpanType.AGENT_RUN> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'original-name',
        type: SpanType.AGENT_RUN,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: true,
        entityId: 'support-agent',
        attributes: {
          agentId: 'support-agent',
          maxSteps: 10,
        } as AgentRunAttributes,
      };

      const result = await converter.convertSpan(span);
      expect(result.name).toBe('invoke_agent support-agent');
    });

    it('should format workflow span names correctly', async () => {
      const span: ExportedSpan<SpanType.WORKFLOW_RUN> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'original-name',
        type: SpanType.WORKFLOW_RUN,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: true,
        entityId: 'data-processing',
        attributes: {
          workflowId: 'data-processing',
          status: 'success',
        } as WorkflowRunAttributes,
      };

      const result = await converter.convertSpan(span);
      expect(result.name).toBe('invoke_workflow data-processing');
    });

    it('should use OTEL-compliant span names for LLM and tool spans', async () => {
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
        entityId: 'calculator',
        attributes: {
          toolId: 'calculator',
        } as ToolCallAttributes,
      };

      const llmResult = await converter.convertSpan(llmSpan);
      const toolResult = await converter.convertSpan(toolSpan);

      expect(llmResult.name).toBe('chat claude-3');
      expect(toolResult.name).toBe('execute_tool calculator');
    });
  });

  // =============================================================================
  // SPAN KIND MAPPING
  // =============================================================================
  describe('Span Kind Mapping', () => {
    it('should use CLIENT for LLM generation spans', async () => {
      const span: ExportedSpan<SpanType.MODEL_GENERATION> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'llm-gen',
        type: SpanType.MODEL_GENERATION,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        attributes: { model: 'gpt-4' } as ModelGenerationAttributes,
      };

      const result = await converter.convertSpan(span);
      expect(result.kind).toBe(SpanKind.CLIENT);
    });

    it('should use INTERNAL for tool calls', async () => {
      const span: ExportedSpan<SpanType.TOOL_CALL> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'tool-call',
        type: SpanType.TOOL_CALL,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        attributes: { toolId: 'test' } as ToolCallAttributes,
      };

      const result = await converter.convertSpan(span);
      expect(result.kind).toBe(SpanKind.INTERNAL);
    });

    it('should use CLIENT for MCP tool calls', async () => {
      const span: ExportedSpan<SpanType.MCP_TOOL_CALL> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'mcp-tool',
        type: SpanType.MCP_TOOL_CALL,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        attributes: {
          toolId: 'test',
          mcpServer: 'server-1',
        } as MCPToolCallAttributes,
      };

      const result = await converter.convertSpan(span);
      expect(result.kind).toBe(SpanKind.CLIENT);
    });
  });

  // =============================================================================
  // TOKEN USAGE ATTRIBUTE MAPPING
  // =============================================================================
  describe('Token Usage Attribute Mapping', () => {
    it('should map token format with inputDetails/outputDetails correctly', async () => {
      const span: ExportedSpan<SpanType.MODEL_GENERATION> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'llm-gen',
        type: SpanType.MODEL_GENERATION,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        attributes: {
          model: 'gpt-4',
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            inputDetails: { cacheRead: 30 },
            outputDetails: { reasoning: 20 },
          },
        } as ModelGenerationAttributes,
      };

      const result = await converter.convertSpan(span);
      const attrs = result.attributes;

      expect(attrs['gen_ai.usage.input_tokens']).toBe(100);
      expect(attrs['gen_ai.usage.output_tokens']).toBe(50);
      expect(attrs['gen_ai.usage.reasoning_tokens']).toBe(20);
      expect(attrs['gen_ai.usage.cached_input_tokens']).toBe(30);

      // Should NOT have old naming
      expect(attrs['llm.usage.prompt_tokens']).toBeUndefined();
      expect(attrs['gen_ai.usage.prompt_tokens']).toBeUndefined();
    });
  });

  // =============================================================================
  // OTEL GENAI ATTRIBUTES
  // =============================================================================
  describe('OTEL GenAI Attributes', () => {
    it('should include gen_ai.operation.name', async () => {
      const span: ExportedSpan<SpanType.MODEL_GENERATION> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'llm-gen',
        type: SpanType.MODEL_GENERATION,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        attributes: {
          model: 'gpt-4',
          resultType: 'response_generation',
        } as ModelGenerationAttributes,
      };

      const result = await converter.convertSpan(span);
      expect(result.attributes['gen_ai.operation.name']).toBe('chat');
    });

    it('should map LLM parameters to OTEL conventions', async () => {
      const span: ExportedSpan<SpanType.MODEL_GENERATION> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'llm-gen',
        type: SpanType.MODEL_GENERATION,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          parameters: {
            temperature: 0.7,
            maxOutputTokens: 2000,
            topP: 0.9,
            topK: 40,
            presencePenalty: 0.1,
            frequencyPenalty: 0.2,
            stopSequences: ['\\n', 'END'],
          },
          finishReason: 'stop',
        } as ModelGenerationAttributes,
      };

      const result = await converter.convertSpan(span);
      const attrs = result.attributes;

      expect(attrs['gen_ai.request.model']).toBe('gpt-4');
      expect(attrs['gen_ai.provider.name']).toBe('openai');
      expect(attrs['gen_ai.request.temperature']).toBe(0.7);
      expect(attrs['gen_ai.request.max_tokens']).toBe(2000);
      expect(attrs['gen_ai.request.top_p']).toBe(0.9);
      expect(attrs['gen_ai.request.top_k']).toBe(40);
      expect(attrs['gen_ai.request.presence_penalty']).toBe(0.1);
      expect(attrs['gen_ai.request.frequency_penalty']).toBe(0.2);
      expect(attrs['gen_ai.request.stop_sequences']).toBe('["\\\\n","END"]');
      expect(attrs['gen_ai.response.finish_reasons']).toBe('["stop"]');
    });

    it('should include all OTEL Gen AI semantic conventions', async () => {
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
          },
          parameters: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          },
        } as ModelGenerationAttributes,
      };

      const result = await converter.convertSpan(span);

      expect(result.attributes['gen_ai.operation.name']).toBe('chat');
      expect(result.attributes['gen_ai.request.model']).toBe('gpt-4');
      expect(result.attributes['gen_ai.provider.name']).toBe('openai');
      expect(result.attributes['gen_ai.usage.input_tokens']).toBe(100);
      expect(result.attributes['gen_ai.usage.output_tokens']).toBe(50);
      expect(result.attributes['gen_ai.request.temperature']).toBe(0.7);
      expect(result.attributes['gen_ai.request.max_tokens']).toBe(1000);
    });

    it('should include agent context attributes on MODEL_GENERATION spans when provided', async () => {
      const span: ExportedSpan<SpanType.MODEL_GENERATION> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'llm-gen',
        type: SpanType.MODEL_GENERATION,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        parentSpanId: 'agent-span',
        entityId: 'my-support-agent',
        entityName: 'Customer Support Agent',
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          usage: {
            inputTokens: 100,
            outputTokens: 50,
          },
        } as ModelGenerationAttributes,
      };

      const result = await converter.convertSpan(span);
      const attrs = result.attributes;

      // Verify agent context is present
      expect(attrs['gen_ai.agent.id']).toBe('my-support-agent');
      expect(attrs['gen_ai.agent.name']).toBe('Customer Support Agent');

      // Verify other attributes are still present
      expect(attrs['gen_ai.request.model']).toBe('gpt-4');
      expect(attrs['gen_ai.provider.name']).toBe('openai');
      expect(attrs['gen_ai.usage.input_tokens']).toBe(100);
      expect(attrs['gen_ai.usage.output_tokens']).toBe(50);
    });

    it('should not include agent context attributes on MODEL_GENERATION spans when not provided', async () => {
      const span: ExportedSpan<SpanType.MODEL_GENERATION> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'llm-gen',
        type: SpanType.MODEL_GENERATION,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
        } as ModelGenerationAttributes,
      };

      const result = await converter.convertSpan(span);
      const attrs = result.attributes;

      // Agent context should not be present
      expect(attrs['gen_ai.agent.id']).toBeUndefined();
      expect(attrs['gen_ai.agent.name']).toBeUndefined();

      // Other attributes should still be present
      expect(attrs['gen_ai.request.model']).toBe('gpt-4');
      expect(attrs['gen_ai.provider.name']).toBe('openai');
    });

    it('should handle tool attributes correctly', async () => {
      const span: ExportedSpan<SpanType.TOOL_CALL> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'tool-call',
        type: SpanType.TOOL_CALL,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        entityId: 'calculator',
        attributes: {
          toolId: 'calculator',
          toolDescription: 'Performs calculations',
          success: true,
        } as ToolCallAttributes,
        input: { expression: '2 + 2' },
        output: { result: 4 },
      };

      const result = await converter.convertSpan(span);
      const attrs = result.attributes;

      expect(attrs['gen_ai.operation.name']).toBe('execute_tool');
      expect(attrs['gen_ai.tool.name']).toBe('calculator');
      expect(attrs['gen_ai.tool.description']).toBe('Performs calculations');
      expect(attrs['gen_ai.tool.call.arguments']).toBe('{"expression":"2 + 2"}');
      expect(attrs['gen_ai.tool.call.result']).toBe('{"result":4}');
    });

    it('should handle MCP tool attributes correctly', async () => {
      const span: ExportedSpan<SpanType.MCP_TOOL_CALL> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'mcp-tool',
        type: SpanType.MCP_TOOL_CALL,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        entityId: 'database_query',
        attributes: {
          toolId: 'database_query',
          mcpServer: 'postgres-server',
          serverVersion: '1.0.0',
          success: false,
        } as MCPToolCallAttributes,
      };

      const result = await converter.convertSpan(span);
      const attrs = result.attributes;

      expect(attrs['gen_ai.tool.name']).toBe('database_query');
      expect(attrs['server.address']).toBe('postgres-server');
    });

    it('should handle agent attributes correctly', async () => {
      const span: ExportedSpan<SpanType.AGENT_RUN> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'agent-run',
        type: SpanType.AGENT_RUN,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        entityId: 'test',
        attributes: {
          availableTools: ['tool1', 'tool2'],
        } as AgentRunAttributes,
      };

      const result = await converter.convertSpan(span);
      const attrs = result.attributes;

      expect(attrs['gen_ai.agent.id']).toBe('test');
      expect(attrs['gen_ai.tool.definitions']).toBe('["tool1","tool2"]');
    });
  });

  // =============================================================================
  // INPUT/OUTPUT HANDLING
  // =============================================================================
  describe('Input/Output Handling', () => {
    it('should use gen_ai.prompt/completion for LLM spans', async () => {
      const span: ExportedSpan<SpanType.MODEL_GENERATION> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'llm-gen',
        type: SpanType.MODEL_GENERATION,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        attributes: { model: 'gpt-4' } as ModelGenerationAttributes,
        input: 'What is the capital of France?',
        output: 'The capital of France is Paris.',
      };

      const result = await converter.convertSpan(span);
      const attrs = result.attributes;

      expect(attrs['gen_ai.input.messages']).toBe('What is the capital of France?');
      expect(attrs['gen_ai.output.messages']).toBe('The capital of France is Paris.');
      expect(attrs['mastra.input']).toBeUndefined();
      expect(attrs['mastra.output']).toBeUndefined();
      expect(attrs['gen_ai.prompt']).toBeUndefined();
      expect(attrs['gen_ai.completion']).toBeUndefined();
    });

    it('should serialize complex input/output', async () => {
      const span: ExportedSpan<SpanType.MODEL_GENERATION> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'llm-gen',
        type: SpanType.MODEL_GENERATION,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        attributes: { model: 'gpt-4' } as ModelGenerationAttributes,
        input: {
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
          ],
        },
        output: {
          content: 'How can I help?',
          role: 'assistant',
        },
      };

      const result = await converter.convertSpan(span);
      const attrs = result.attributes;

      expect(JSON.parse(attrs['gen_ai.input.messages'] as string)).toEqual([
        {
          parts: [
            {
              content: 'Hello',
              type: 'text',
            },
          ],
          role: 'user',
        },
        {
          parts: [
            {
              content: 'Hi there!',
              type: 'text',
            },
          ],
          role: 'assistant',
        },
      ]);
      expect(JSON.parse(attrs['gen_ai.output.messages'] as string)).toEqual({
        content: 'How can I help?',
        role: 'assistant',
      });
    });

    it('should include both generic and specific input/output attributes for LLM spans', async () => {
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

      const result = await converter.convertSpan(span);

      expect(result.attributes['gen_ai.input.messages']).toBeDefined();
      expect(result.attributes['gen_ai.output.messages']).toBeDefined();
    });

    it('should handle tool input/output', async () => {
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

      const result = await converter.convertSpan(span);

      expect(result.attributes['gen_ai.tool.call.arguments']).toBeDefined();
      expect(result.attributes['gen_ai.tool.call.result']).toBeDefined();
    });
  });

  // =============================================================================
  // ERROR HANDLING
  // =============================================================================
  describe('Error Handling', () => {
    it('should add error attributes when error info is present', async () => {
      const span: ExportedSpan<SpanType.MODEL_GENERATION> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'llm-gen',
        type: SpanType.MODEL_GENERATION,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        attributes: { model: 'gpt-4' } as ModelGenerationAttributes,
        errorInfo: {
          message: 'Rate limit exceeded',
          id: 'RATE_LIMIT_ERROR',
          domain: 'API',
          category: 'USER_ERROR',
        },
      };

      const result = await converter.convertSpan(span);
      const attrs = result.attributes;

      expect(attrs['error.type']).toBe('RATE_LIMIT_ERROR');
      expect(attrs['error.message']).toBe('Rate limit exceeded');
      expect(attrs['error.domain']).toBe('API');
      expect(attrs['error.category']).toBe('USER_ERROR');
    });
  });

  // =============================================================================
  // METADATA HANDLING
  // =============================================================================
  describe('Metadata Handling', () => {
    it('should add metadata as custom attributes', async () => {
      const span: ExportedSpan<SpanType.AGENT_RUN> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'agent-run',
        type: SpanType.AGENT_RUN,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: true,
        attributes: { agentId: 'test' } as AgentRunAttributes,
        metadata: {
          userId: 'user-123',
          requestId: 'req-456',
          environment: 'production',
        },
      };

      const result = await converter.convertSpan(span);
      const attrs = result.attributes;

      expect(attrs['mastra.metadata.userId']).toBe('user-123');
      expect(attrs['mastra.metadata.requestId']).toBe('req-456');
      expect(attrs['mastra.metadata.environment']).toBe('production');
    });

    it('should handle metadata properly including nested objects and null values', async () => {
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

      const result = await converter.convertSpan(span);

      expect(result.attributes['mastra.metadata.custom_field']).toBe('value');
      expect(result.attributes['mastra.metadata.nested_object']).toBe('{"key":"value"}');
      expect(result.attributes['mastra.metadata.null_value']).toBeUndefined();
      expect(result.attributes['mastra.metadata.undefined_value']).toBeUndefined();
    });
  });

  // =============================================================================
  // RESOURCE ATTRIBUTES (Provider Compatibility)
  // =============================================================================
  describe('Resource Attributes', () => {
    it('should include service name in resource attributes', async () => {
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

      const result = await converter.convertSpan(span);

      expect(result.resource.attributes[ATTR_SERVICE_NAME]).toBe('test-service');
      expect(result.resource.attributes[ATTR_SERVICE_VERSION]).toBeDefined();
    });

    it('should include debugging attributes', async () => {
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
        attributes: { agentId: 'test', maxSteps: 50 } as AgentRunAttributes,
      };

      const result = await converter.convertSpan(span);

      expect(result.attributes['mastra.span.type']).toBe('agent_run');
      expect(result.attributes['mastra.agent_run.max_steps']).toBe(50);
    });
  });

  // =============================================================================
  // PARENT-CHILD RELATIONSHIPS & TRACE CONTEXT
  // =============================================================================
  describe('Parent-Child Relationships', () => {
    it('should preserve parentSpanId from Mastra span', async () => {
      const rootSpan: ExportedSpan<SpanType.AGENT_RUN> = {
        id: 'root-span',
        traceId: 'trace-1',
        name: 'agent-run',
        type: SpanType.AGENT_RUN,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: true,
        parentSpanId: undefined,
        attributes: { agentId: 'test-agent' } as AgentRunAttributes,
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
        parentSpanId: 'root-span',
        attributes: { model: 'gpt-4' } as ModelGenerationAttributes,
      };

      const rootResult = await converter.convertSpan(rootSpan);
      const childResult = await converter.convertSpan(childSpan);

      expect(rootResult.parentSpanContext).toBeUndefined();
      expect(childResult.parentSpanContext?.spanId).toBe('root-span');
    });

    it('should handle multi-level hierarchy', async () => {
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
        attributes: { workflowId: 'main-workflow' } as WorkflowRunAttributes,
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
        attributes: { stepId: 'process-data' } as WorkflowStepAttributes,
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
        attributes: { model: 'claude-3' } as ModelGenerationAttributes,
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
        attributes: { toolId: 'calculator' } as ToolCallAttributes,
      };

      const rootResult = await converter.convertSpan(rootSpan);
      const stepResult = await converter.convertSpan(stepSpan);
      const llmResult = await converter.convertSpan(llmSpan);
      const toolResult = await converter.convertSpan(toolSpan);

      expect(rootResult.parentSpanContext).toBeUndefined();
      expect(stepResult.parentSpanContext?.spanId).toBe('workflow-root');
      expect(llmResult.parentSpanContext?.spanId).toBe('step-1');
      expect(toolResult.parentSpanContext?.spanId).toBe('llm-1');
    });

    it('should handle spans with non-existent parent IDs (orphaned spans)', async () => {
      const span: ExportedSpan<SpanType.TOOL_CALL> = {
        id: 'orphan-span',
        traceId: 'trace-1',
        name: 'tool',
        type: SpanType.TOOL_CALL,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        parentSpanId: 'non-existent-parent',
        attributes: { toolId: 'orphaned-tool' } as ToolCallAttributes,
      };

      const result = await converter.convertSpan(span);

      // Should preserve the parent ID even if it doesn't exist
      expect(result.parentSpanContext?.spanId).toBe('non-existent-parent');
    });

    it('should handle multiple children of the same parent (parallel execution)', async () => {
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
        attributes: { workflowId: 'parallel-workflow' } as WorkflowRunAttributes,
      };

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
            parentSpanId: 'workflow-1',
            attributes: { stepId } as WorkflowStepAttributes,
          }) as ExportedSpan<SpanType.WORKFLOW_STEP>,
      );

      const rootResult = await converter.convertSpan(rootSpan);
      const stepResults = await Promise.all(parallelSteps.map(span => converter.convertSpan(span)));

      expect(rootResult.parentSpanContext).toBeUndefined();
      stepResults.forEach(result => {
        expect(result.parentSpanContext?.spanId).toBe('workflow-1');
      });
    });
  });

  // =============================================================================
  // TRACE CONTEXT PRESERVATION
  // =============================================================================
  describe('Trace Context Preservation', () => {
    it('should maintain trace ID across all spans', async () => {
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

      const results = await Promise.all(spans.map(span => converter.convertSpan(span)));

      // All spans should have same trace ID
      results.forEach(result => {
        expect(result.spanContext().traceId).toBe(traceId);
      });

      // Parent relationships should be preserved
      expect(results[0].parentSpanContext).toBeUndefined();
      expect(results[1].parentSpanContext?.spanId).toBe('span-1');
      expect(results[2].parentSpanContext?.spanId).toBe('span-1');
    });

    it('should preserve span IDs', async () => {
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

      const result = await converter.convertSpan(span);

      expect(result.spanContext().spanId).toBe('unique-span-id-123');
      expect(result.spanContext().traceId).toBe('trace-abc');
    });
  });

  // =============================================================================
  // COMPLEX AGENT EXECUTION HIERARCHY
  // =============================================================================
  describe('Complex Agent Execution Hierarchy', () => {
    it('should handle typical agent execution with tools and LLM calls', async () => {
      const baseTime = new Date();
      const spans: ExportedSpan<any>[] = [
        {
          id: 'agent-1',
          traceId: 'trace-1',
          name: 'agent-run',
          type: SpanType.AGENT_RUN,
          entityId: 'customer-support',
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
        {
          id: 'tool-1',
          traceId: 'trace-1',
          name: 'search-kb',
          type: SpanType.TOOL_CALL,
          entityId: 'knowledge_base_search',
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

      const results = await Promise.all(spans.map(span => converter.convertSpan(span)));

      // Verify hierarchy structure
      expect(results[0].parentSpanContext).toBeUndefined();
      expect(results[1].parentSpanContext?.spanId).toBe('agent-1');
      expect(results[2].parentSpanContext?.spanId).toBe('agent-1');
      expect(results[3].parentSpanContext?.spanId).toBe('agent-1');

      // Verify naming conventions are applied
      expect(results[0].name).toBe('invoke_agent customer-support');
      expect(results[1].name).toBe('chat gpt-4');
      expect(results[2].name).toBe('execute_tool knowledge_base_search');
      expect(results[3].name).toBe('chat gpt-4');

      // Verify all have same trace ID
      results.forEach(result => {
        expect(result.spanContext().traceId).toBe('trace-1');
      });
    });
  });
});
