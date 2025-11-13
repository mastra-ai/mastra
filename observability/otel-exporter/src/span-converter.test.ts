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
} from '@mastra/core/observability';
import { SpanKind } from '@opentelemetry/api';
import { describe, it, expect, beforeEach } from 'vitest';
import { SpanConverter } from './span-converter.js';

describe('SpanConverter', () => {
  let converter: SpanConverter;

  beforeEach(() => {
    converter = new SpanConverter();
  });

  describe('Span Naming Conventions', () => {
    it('should format LLM generation span names correctly', () => {
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

      const result = converter.convertSpan(span);
      expect(result.name).toBe('chat gpt-4');
    });

    it('should use tool_selection for tool selection LLM calls', () => {
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
          model: 'claude-3',
          provider: 'anthropic',
          resultType: 'tool_selection',
        } as ModelGenerationAttributes,
      };

      const result = converter.convertSpan(span);
      expect(result.name).toBe('tool_selection claude-3');
    });

    it('should format tool call span names correctly', () => {
      const span: ExportedSpan<SpanType.TOOL_CALL> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'original-name',
        type: SpanType.TOOL_CALL,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        attributes: {
          toolId: 'get_weather',
          toolDescription: 'Gets weather data',
        } as ToolCallAttributes,
      };

      const result = converter.convertSpan(span);
      expect(result.name).toBe('tool.execute get_weather');
    });

    it('should format agent span names correctly', () => {
      const span: ExportedSpan<SpanType.AGENT_RUN> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'original-name',
        type: SpanType.AGENT_RUN,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: true,
        attributes: {
          agentId: 'support-agent',
          maxSteps: 10,
        } as AgentRunAttributes,
      };

      const result = converter.convertSpan(span);
      expect(result.name).toBe('agent.support-agent');
    });

    it('should format workflow span names correctly', () => {
      const span: ExportedSpan<SpanType.WORKFLOW_RUN> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'original-name',
        type: SpanType.WORKFLOW_RUN,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: true,
        attributes: {
          workflowId: 'data-processing',
          status: 'completed',
        } as WorkflowRunAttributes,
      };

      const result = converter.convertSpan(span);
      expect(result.name).toBe('workflow.data-processing');
    });
  });

  describe('Span Kind Mapping', () => {
    it('should use SERVER for root agent spans', () => {
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
      };

      const result = converter.convertSpan(span);
      expect(result.kind).toBe(SpanKind.SERVER);
    });

    it('should use SERVER for root workflow spans', () => {
      const span: ExportedSpan<SpanType.WORKFLOW_RUN> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'workflow-run',
        type: SpanType.WORKFLOW_RUN,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: true,
        attributes: { workflowId: 'test' } as WorkflowRunAttributes,
      };

      const result = converter.convertSpan(span);
      expect(result.kind).toBe(SpanKind.SERVER);
    });

    it('should use CLIENT for LLM generation spans', () => {
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

      const result = converter.convertSpan(span);
      expect(result.kind).toBe(SpanKind.CLIENT);
    });

    it('should use INTERNAL for tool calls', () => {
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

      const result = converter.convertSpan(span);
      expect(result.kind).toBe(SpanKind.INTERNAL);
    });

    it('should use CLIENT for MCP tool calls', () => {
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

      const result = converter.convertSpan(span);
      expect(result.kind).toBe(SpanKind.CLIENT);
    });
  });

  describe('Token Usage Attribute Mapping', () => {
    it('should map v5 token format correctly', () => {
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
            totalTokens: 150,
            reasoningTokens: 20,
            cachedInputTokens: 30,
          },
        } as ModelGenerationAttributes,
      };

      const result = converter.convertSpan(span);
      const attrs = result.attributes;

      expect(attrs['gen_ai.usage.input_tokens']).toBe(100);
      expect(attrs['gen_ai.usage.output_tokens']).toBe(50);
      expect(attrs['gen_ai.usage.total_tokens']).toBe(150);
      expect(attrs['gen_ai.usage.reasoning_tokens']).toBe(20);
      expect(attrs['gen_ai.usage.cached_input_tokens']).toBe(30);

      // Should NOT have old naming
      expect(attrs['llm.usage.prompt_tokens']).toBeUndefined();
      expect(attrs['gen_ai.usage.prompt_tokens']).toBeUndefined();
    });

    it('should map legacy token format correctly', () => {
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
          model: 'gpt-3.5-turbo',
          usage: {
            promptTokens: 80,
            completionTokens: 40,
            totalTokens: 120,
          },
        } as ModelGenerationAttributes,
      };

      const result = converter.convertSpan(span);
      const attrs = result.attributes;

      expect(attrs['gen_ai.usage.input_tokens']).toBe(80);
      expect(attrs['gen_ai.usage.output_tokens']).toBe(40);
      expect(attrs['gen_ai.usage.total_tokens']).toBe(120);

      // Should NOT have duplicate attributes
      expect(attrs['llm.usage.prompt_tokens']).toBeUndefined();
      expect(attrs['gen_ai.usage.prompt_tokens']).toBeUndefined();
    });
  });

  describe('OTEL GenAI Attributes', () => {
    it('should include gen_ai.operation.name', () => {
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

      const result = converter.convertSpan(span);
      expect(result.attributes['gen_ai.operation.name']).toBe('chat');
    });

    it('should map LLM parameters to OTEL conventions', () => {
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

      const result = converter.convertSpan(span);
      const attrs = result.attributes;

      expect(attrs['gen_ai.request.model']).toBe('gpt-4');
      expect(attrs['gen_ai.system']).toBe('openai');
      expect(attrs['gen_ai.request.temperature']).toBe(0.7);
      expect(attrs['gen_ai.request.max_tokens']).toBe(2000);
      expect(attrs['gen_ai.request.top_p']).toBe(0.9);
      expect(attrs['gen_ai.request.top_k']).toBe(40);
      expect(attrs['gen_ai.request.presence_penalty']).toBe(0.1);
      expect(attrs['gen_ai.request.frequency_penalty']).toBe(0.2);
      expect(attrs['gen_ai.request.stop_sequences']).toBe('["\\\\n","END"]');
      expect(attrs['gen_ai.response.finish_reasons']).toBe('stop');

      // Should NOT have llm.* attributes
      expect(attrs['llm.model']).toBeUndefined();
      expect(attrs['llm.provider']).toBeUndefined();
    });

    it('should handle tool attributes correctly', () => {
      const span: ExportedSpan<SpanType.TOOL_CALL> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'tool-call',
        type: SpanType.TOOL_CALL,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        attributes: {
          toolId: 'calculator',
          toolDescription: 'Performs calculations',
          success: true,
        } as ToolCallAttributes,
        input: { expression: '2 + 2' },
        output: { result: 4 },
      };

      const result = converter.convertSpan(span);
      const attrs = result.attributes;

      expect(attrs['gen_ai.operation.name']).toBe('tool.execute');
      expect(attrs['gen_ai.tool.name']).toBe('calculator');
      expect(attrs['gen_ai.tool.description']).toBe('Performs calculations');
      expect(attrs['gen_ai.tool.success']).toBe(true);
      expect(attrs['gen_ai.tool.input']).toBe('{"expression":"2 + 2"}');
      expect(attrs['gen_ai.tool.output']).toBe('{"result":4}');
    });

    it('should handle MCP tool attributes correctly', () => {
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
          toolId: 'database_query',
          mcpServer: 'postgres-server',
          serverVersion: '1.0.0',
          success: false,
        } as MCPToolCallAttributes,
      };

      const result = converter.convertSpan(span);
      const attrs = result.attributes;

      expect(attrs['gen_ai.tool.name']).toBe('database_query');
      expect(attrs['mcp.server']).toBe('postgres-server');
      expect(attrs['mcp.server.version']).toBe('1.0.0');
      expect(attrs['gen_ai.tool.success']).toBe(false);
    });

    it('should handle agent attributes correctly', () => {
      const span: ExportedSpan<SpanType.AGENT_RUN> = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'agent-run',
        type: SpanType.AGENT_RUN,
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        attributes: {
          agentId: 'test',
          maxSteps: 10,
          availableTools: ['tool1', 'tool2'],
        },
      };

      const result = converter.convertSpan(span);
      const attrs = result.attributes;

      expect(attrs['gen_ai.agent.id']).toBe('test');
      expect(attrs['agent.id']).toBe('test');
      expect(attrs['agent.max_steps']).toBe(10);
      expect(attrs['agent.available_tools']).toBe('["tool1","tool2"]');
    });
  });

  describe('Input/Output Handling', () => {
    it('should use gen_ai.prompt/completion for LLM spans', () => {
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

      const result = converter.convertSpan(span);
      const attrs = result.attributes;

      expect(attrs['gen_ai.prompt']).toBe('What is the capital of France?');
      expect(attrs['gen_ai.completion']).toBe('The capital of France is Paris.');
      expect(attrs['mastra.input']).toBeUndefined();
      expect(attrs['mastra.output']).toBeUndefined();
    });

    it('should serialize complex input/output', () => {
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

      const result = converter.convertSpan(span);
      const attrs = result.attributes;

      expect(JSON.parse(attrs['gen_ai.prompt'] as string)).toEqual({
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      });
      expect(JSON.parse(attrs['gen_ai.completion'] as string)).toEqual({
        content: 'How can I help?',
        role: 'assistant',
      });
    });
  });

  describe('Error Handling', () => {
    it('should add error attributes when error info is present', () => {
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

      const result = converter.convertSpan(span);
      const attrs = result.attributes;

      expect(attrs['error']).toBe(true);
      expect(attrs['error.type']).toBe('RATE_LIMIT_ERROR');
      expect(attrs['error.message']).toBe('Rate limit exceeded');
      expect(attrs['error.domain']).toBe('API');
      expect(attrs['error.category']).toBe('USER_ERROR');
    });
  });

  describe('Metadata Handling', () => {
    it('should add metadata as custom attributes', () => {
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

      const result = converter.convertSpan(span);
      const attrs = result.attributes;

      expect(attrs['userId']).toBe('user-123');
      expect(attrs['requestId']).toBe('req-456');
      expect(attrs['environment']).toBe('production');

      // Should not nest under mastra.metadata
      expect(attrs['mastra.metadata.userId']).toBeUndefined();
    });
  });
});
