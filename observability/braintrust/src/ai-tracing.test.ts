/**
 * Braintrust Exporter Tests
 *
 * These tests focus on Braintrust-specific functionality:
 * - Braintrust client interactions
 * - Mapping logic (spans -> Braintrust spans with correct types)
 * - Event handling as zero-duration spans
 * - Type-specific metadata extraction
 * - Braintrust-specific error handling
 */

import type { AITracingEvent, AnyAISpan, LLMGenerationAttributes, ToolCallAttributes } from '@mastra/core/ai-tracing';
import { AISpanType, AITracingEventType } from '@mastra/core/ai-tracing';
import { initLogger } from 'braintrust';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BraintrustExporter } from './ai-tracing';
import type { BraintrustExporterConfig } from './ai-tracing';

// Mock Braintrust initLogger function (must be at the top level)
vi.mock('braintrust');

describe('BraintrustExporter', () => {
  // Mock objects
  let mockSpan: any;
  let mockLogger: any;
  let mockInitLogger: any;

  let exporter: BraintrustExporter;
  let config: BraintrustExporterConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up mocks
    mockSpan = {
      startSpan: vi.fn(),
      log: vi.fn(),
      end: vi.fn(),
    };

    // Set up circular reference for nested spans
    mockSpan.startSpan.mockReturnValue(mockSpan);

    mockLogger = {
      startSpan: vi.fn().mockReturnValue(mockSpan),
    };

    mockInitLogger = vi.mocked(initLogger);
    mockInitLogger.mockResolvedValue(mockLogger);

    config = {
      apiKey: 'test-api-key',
      endpoint: 'https://test-braintrust.com',
      logLevel: 'debug',
      tuningParameters: {
        debug: true,
      },
    };

    exporter = new BraintrustExporter(config);
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(exporter.name).toBe('braintrust');
    });

    it('should disable exporter when apiKey is missing', async () => {
      const mockConsole = vi.spyOn(console, 'error').mockImplementation(() => {});

      const invalidConfig = {
        // Missing apiKey
        endpoint: 'https://test.com',
      };

      const disabledExporter = new BraintrustExporter(invalidConfig);

      // Should log error about missing credentials
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('BraintrustExporter: Missing required credentials, exporter will be disabled'),
        expect.objectContaining({
          hasApiKey: false,
        }),
      );

      // Should not create spans when disabled
      const rootSpan = createMockSpan({
        id: 'test-span',
        name: 'test',
        type: AISpanType.GENERIC,
        isRoot: true,
        attributes: {},
      });

      await disabledExporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: rootSpan,
      });

      expect(mockInitLogger).not.toHaveBeenCalled();

      mockConsole.mockRestore();
    });
  });

  describe('Logger Creation', () => {
    it('should create Braintrust logger for root spans', async () => {
      const rootSpan = createMockSpan({
        id: 'root-span-id',
        name: 'root-agent',
        type: AISpanType.AGENT_RUN,
        isRoot: true,
        attributes: {
          agentId: 'agent-123',
          instructions: 'Test agent',
        },
        metadata: { userId: 'user-456', sessionId: 'session-789' },
      });

      const event: AITracingEvent = {
        type: AITracingEventType.SPAN_STARTED,
        span: rootSpan,
      };

      await exporter.exportEvent(event);

      // Should create Braintrust logger with correct parameters
      expect(mockInitLogger).toHaveBeenCalledWith({
        projectName: 'mastra-tracing',
        apiKey: 'test-api-key',
        appUrl: 'https://test-braintrust.com',
        debug: true,
      });

      // Should create Braintrust span with correct type and payload
      expect(mockLogger.startSpan).toHaveBeenCalledWith({
        name: 'root-agent',
        type: 'task', // Default span type mapping for AGENT_RUN
        input: undefined,
        metadata: {
          spanType: 'agent_run',
          agentId: 'agent-123',
          instructions: 'Test agent',
          userId: 'user-456',
          sessionId: 'session-789',
        },
      });
    });

    it('should not create logger for child spans', async () => {
      // First create root span
      const rootSpan = createMockSpan({
        id: 'root-span-id',
        name: 'root-agent',
        type: AISpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: rootSpan,
      });

      vi.clearAllMocks();

      // Then create child span
      const childSpan = createMockSpan({
        id: 'child-span-id',
        name: 'child-tool',
        type: AISpanType.TOOL_CALL,
        isRoot: false,
        attributes: { toolId: 'calculator' },
      });
      childSpan.traceId = 'root-span-id';
      childSpan.parent = { id: 'root-span-id' };

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: childSpan,
      });

      // Should not create new logger for child spans
      expect(mockInitLogger).not.toHaveBeenCalled();

      // Should create child span on parent span
      expect(mockSpan.startSpan).toHaveBeenCalledWith({
        name: 'child-tool',
        type: 'tool', // TOOL_CALL maps to 'tool'
        input: undefined,
        metadata: {
          spanType: 'tool_call',
          toolId: 'calculator',
        },
      });
    });
  });

  describe('Span Type Mappings', () => {
    it('should map LLM_GENERATION to "llm" type', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-span',
        name: 'gpt-4-call',
        type: AISpanType.LLM_GENERATION,
        isRoot: true,
        attributes: { model: 'gpt-4' },
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'llm',
        }),
      );
    });

    it('should map LLM_CHUNK to "llm" type', async () => {
      const chunkSpan = createMockSpan({
        id: 'chunk-span',
        name: 'llm-chunk',
        type: AISpanType.LLM_CHUNK,
        isRoot: true,
        attributes: { chunkType: 'text-delta' },
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: chunkSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'llm',
        }),
      );
    });

    it('should map TOOL_CALL to "tool" type', async () => {
      const toolSpan = createMockSpan({
        id: 'tool-span',
        name: 'calculator',
        type: AISpanType.TOOL_CALL,
        isRoot: true,
        attributes: { toolId: 'calc' },
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: toolSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tool',
        }),
      );
    });

    it('should map MCP_TOOL_CALL to "tool" type', async () => {
      const mcpSpan = createMockSpan({
        id: 'mcp-span',
        name: 'mcp-tool',
        type: AISpanType.MCP_TOOL_CALL,
        isRoot: true,
        attributes: { toolId: 'file-reader', mcpServer: 'fs-server' },
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: mcpSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tool',
        }),
      );
    });

    it('should map WORKFLOW_CONDITIONAL_EVAL to "function" type', async () => {
      const condSpan = createMockSpan({
        id: 'cond-span',
        name: 'condition-eval',
        type: AISpanType.WORKFLOW_CONDITIONAL_EVAL,
        isRoot: true,
        attributes: { conditionIndex: 0, result: true },
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: condSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'function',
        }),
      );
    });

    it('should map WORKFLOW_WAIT_EVENT to "function" type', async () => {
      const waitSpan = createMockSpan({
        id: 'wait-span',
        name: 'wait-event',
        type: AISpanType.WORKFLOW_WAIT_EVENT,
        isRoot: true,
        attributes: { eventName: 'user-input', timeoutMs: 30000 },
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: waitSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'function',
        }),
      );
    });

    it('should default to "task" type for other span types', async () => {
      const genericSpan = createMockSpan({
        id: 'generic-span',
        name: 'generic',
        type: AISpanType.GENERIC,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: genericSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task',
        }),
      );

      // Test other span types that should default to 'task'
      const agentSpan = createMockSpan({
        id: 'agent-span',
        name: 'agent',
        type: AISpanType.AGENT_RUN,
        isRoot: true,
        attributes: { agentId: 'test-agent' },
      });

      vi.clearAllMocks();
      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: agentSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task',
        }),
      );
    });
  });

  describe('LLM Generation Attributes', () => {
    it('should handle LLM generation with full attributes', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-span',
        name: 'gpt-4-call',
        type: AISpanType.LLM_GENERATION,
        isRoot: true,
        input: { messages: [{ role: 'user', content: 'Hello' }] },
        output: { content: 'Hi there!' },
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          usage: {
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15,
          },
          parameters: {
            temperature: 0.7,
            maxTokens: 100,
          },
          streaming: false,
          resultType: 'response_generation',
        },
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith({
        name: 'gpt-4-call',
        type: 'llm',
        input: { messages: [{ role: 'user', content: 'Hello' }] },
        output: { content: 'Hi there!' },
        metrics: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        },
        metadata: {
          spanType: 'llm_generation',
          model: 'gpt-4',
          provider: 'openai',
          streaming: false,
          resultType: 'response_generation',
          modelParameters: {
            temperature: 0.7,
            maxTokens: 100,
          },
        },
      });
    });

    it('should handle minimal LLM generation attributes', async () => {
      const llmSpan = createMockSpan({
        id: 'minimal-llm',
        name: 'simple-llm',
        type: AISpanType.LLM_GENERATION,
        isRoot: true,
        attributes: {
          model: 'gpt-3.5-turbo',
        },
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith({
        name: 'simple-llm',
        type: 'llm',
        metadata: {
          spanType: 'llm_generation',
          model: 'gpt-3.5-turbo',
        },
      });
    });
  });

  describe('Span Updates', () => {
    it('should log updates to existing spans', async () => {
      // First, start a span
      const toolSpan = createMockSpan({
        id: 'tool-span',
        name: 'calculator',
        type: AISpanType.TOOL_CALL,
        isRoot: true,
        attributes: { toolId: 'calc', success: false },
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: toolSpan,
      });

      // Then update it
      toolSpan.attributes = {
        ...toolSpan.attributes,
        success: true,
      } as ToolCallAttributes;
      toolSpan.output = { result: 42 };

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_UPDATED,
        span: toolSpan,
      });

      expect(mockSpan.log).toHaveBeenCalledWith({
        output: { result: 42 },
        metadata: {
          spanType: 'tool_call',
          toolId: 'calc',
          success: true,
        },
      });
    });

    it('should log updates to LLM generations', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-span',
        name: 'gpt-4-call',
        type: AISpanType.LLM_GENERATION,
        isRoot: true,
        attributes: { model: 'gpt-4' },
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: llmSpan,
      });

      // Update with usage info
      llmSpan.attributes = {
        ...llmSpan.attributes,
        usage: { totalTokens: 150 },
      } as LLMGenerationAttributes;
      llmSpan.output = { content: 'Updated response' };

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_UPDATED,
        span: llmSpan,
      });

      expect(mockSpan.log).toHaveBeenCalledWith({
        output: { content: 'Updated response' },
        metrics: { totalTokens: 150 },
        metadata: {
          spanType: 'llm_generation',
          model: 'gpt-4',
        },
      });
    });
  });

  describe('Span Ending', () => {
    it('should end span and log final data', async () => {
      const span = createMockSpan({
        id: 'test-span',
        name: 'test',
        type: AISpanType.GENERIC,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span,
      });

      span.endTime = new Date();
      span.output = { result: 'success' };

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span,
      });

      expect(mockSpan.log).toHaveBeenCalledWith({
        output: { result: 'success' },
        metadata: {
          spanType: 'generic',
        },
      });

      expect(mockSpan.end).toHaveBeenCalledWith({ endTime: span.endTime.getTime() / 1000 });
    });

    it('should handle spans with error information', async () => {
      const errorSpan = createMockSpan({
        id: 'error-span',
        name: 'failing-operation',
        type: AISpanType.TOOL_CALL,
        isRoot: true,
        attributes: { toolId: 'failing-tool' },
        errorInfo: {
          message: 'Tool execution failed',
          id: 'TOOL_ERROR',
          category: 'EXECUTION',
        },
      });

      errorSpan.endTime = new Date();

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: errorSpan,
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: errorSpan,
      });

      expect(mockSpan.log).toHaveBeenCalledWith({
        error: 'Tool execution failed',
        metadata: {
          spanType: 'tool_call',
          toolId: 'failing-tool',
          errorDetails: {
            message: 'Tool execution failed',
            id: 'TOOL_ERROR',
            category: 'EXECUTION',
          },
        },
      });

      expect(mockSpan.end).toHaveBeenCalledWith({ endTime: errorSpan.endTime.getTime() / 1000 });
    });

    it('should clean up traceMap when root span ends', async () => {
      const rootSpan = createMockSpan({
        id: 'root-span',
        name: 'root',
        type: AISpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: rootSpan,
      });

      // Verify trace was created
      expect((exporter as any).traceMap.has('root-span')).toBe(true);

      rootSpan.endTime = new Date();

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: rootSpan,
      });

      // Should clean up traceMap
      expect((exporter as any).traceMap.has('root-span')).toBe(false);
    });
  });

  describe('Event Span Handling', () => {
    it('should create zero-duration spans for root event spans', async () => {
      const eventSpan = createMockSpan({
        id: 'event-span',
        name: 'user-feedback',
        type: AISpanType.GENERIC,
        isRoot: true,
        attributes: {
          eventType: 'user_feedback',
          rating: 5,
        },
        output: { message: 'Great response!' },
      });
      eventSpan.isEvent = true;

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: eventSpan,
      });

      // Should create logger for root event
      expect(mockInitLogger).toHaveBeenCalledWith({
        projectName: 'mastra-tracing',
        apiKey: 'test-api-key',
        appUrl: 'https://test-braintrust.com',
        debug: true,
      });

      // Should create span with zero duration (matching start/end times)
      expect(mockLogger.startSpan).toHaveBeenCalledWith({
        name: 'user-feedback',
        type: 'task',
        startTime: eventSpan.startTime.getTime() / 1000,
        output: { message: 'Great response!' },
        metadata: {
          spanType: 'generic',
          eventType: 'user_feedback',
          rating: 5,
        },
      });

      // Should immediately end with same timestamp
      expect(mockSpan.end).toHaveBeenCalledWith({ endTime: eventSpan.startTime.getTime() / 1000 });
    });

    it('should create zero-duration child spans for child event spans', async () => {
      // First create root span
      const rootSpan = createMockSpan({
        id: 'root-span',
        name: 'root-agent',
        type: AISpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: rootSpan,
      });

      // Then create child event span
      const childEventSpan = createMockSpan({
        id: 'child-event',
        name: 'tool-result',
        type: AISpanType.GENERIC,
        isRoot: false,
        attributes: {
          toolName: 'calculator',
          success: true,
        },
        output: { result: 42 },
      });
      childEventSpan.isEvent = true;
      childEventSpan.traceId = 'root-span';
      childEventSpan.parent = { id: 'root-span' };

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: childEventSpan,
      });

      // Should create child span on parent
      expect(mockSpan.startSpan).toHaveBeenCalledWith({
        name: 'tool-result',
        type: 'task',
        startTime: childEventSpan.startTime.getTime() / 1000,
        output: { result: 42 },
        metadata: {
          spanType: 'generic',
          toolName: 'calculator',
          success: true,
        },
      });
    });

    it('should handle orphan event spans gracefully', async () => {
      const orphanEventSpan = createMockSpan({
        id: 'orphan-event',
        name: 'orphan',
        type: AISpanType.GENERIC,
        isRoot: false,
        attributes: {},
      });
      orphanEventSpan.isEvent = true;
      orphanEventSpan.traceId = 'missing-trace';

      // Should not throw
      await expect(
        exporter.exportEvent({
          type: AITracingEventType.SPAN_STARTED,
          span: orphanEventSpan,
        }),
      ).resolves.not.toThrow();

      // Should not create any spans
      expect(mockLogger.startSpan).not.toHaveBeenCalled();
      expect(mockSpan.startSpan).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing traces gracefully', async () => {
      const orphanSpan = createMockSpan({
        id: 'orphan-span',
        name: 'orphan',
        type: AISpanType.TOOL_CALL,
        isRoot: false,
        attributes: { toolId: 'orphan-tool' },
      });

      // Should not throw when trying to create child span without parent
      await expect(
        exporter.exportEvent({
          type: AITracingEventType.SPAN_STARTED,
          span: orphanSpan,
        }),
      ).resolves.not.toThrow();

      // Should not create any spans
      expect(mockLogger.startSpan).not.toHaveBeenCalled();
    });

    it('should handle missing spans gracefully', async () => {
      const span = createMockSpan({
        id: 'missing-span',
        name: 'missing',
        type: AISpanType.GENERIC,
        isRoot: true,
        attributes: {},
      });

      // Try to update non-existent span
      await expect(
        exporter.exportEvent({
          type: AITracingEventType.SPAN_UPDATED,
          span,
        }),
      ).resolves.not.toThrow();

      // Try to end non-existent span
      await expect(
        exporter.exportEvent({
          type: AITracingEventType.SPAN_ENDED,
          span,
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('Shutdown', () => {
    it('should end all spans and clear traceMap', async () => {
      // Create some spans
      const rootSpan = createMockSpan({
        id: 'root-span',
        name: 'root',
        type: AISpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: rootSpan,
      });

      // Verify maps have data
      expect((exporter as any).traceMap.size).toBeGreaterThan(0);

      // Shutdown
      await exporter.shutdown();

      // Verify all spans were ended
      expect(mockSpan.end).toHaveBeenCalled();

      // Verify maps were cleared
      expect((exporter as any).traceMap.size).toBe(0);
    });

    it('should handle shutdown when exporter is disabled', async () => {
      const disabledExporter = new BraintrustExporter({});

      // Should not throw
      await expect(disabledExporter.shutdown()).resolves.not.toThrow();
    });
  });
});

// Helper function to create mock spans
function createMockSpan({
  id,
  name,
  type,
  isRoot,
  attributes,
  metadata,
  input,
  output,
  errorInfo,
}: {
  id: string;
  name: string;
  type: AISpanType;
  isRoot: boolean;
  attributes: any;
  metadata?: Record<string, any>;
  input?: any;
  output?: any;
  errorInfo?: any;
}): AnyAISpan {
  const mockSpan = {
    id,
    name,
    type,
    attributes,
    metadata,
    input,
    output,
    errorInfo,
    startTime: new Date(),
    endTime: undefined,
    traceId: isRoot ? id : 'parent-trace-id',
    get isRootSpan() {
      return isRoot;
    },
    parent: isRoot ? undefined : { id: 'parent-id' },
    aiTracing: {} as any,
    end: vi.fn(),
    error: vi.fn(),
    update: vi.fn(),
    createChildSpan: vi.fn(),
    createEventSpan: vi.fn(),
    isEvent: false,
  } as AnyAISpan;

  return mockSpan;
}
