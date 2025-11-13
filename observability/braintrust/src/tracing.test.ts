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

import type {
  TracingEvent,
  AnyExportedSpan,
  ModelGenerationAttributes,
  ToolCallAttributes,
} from '@mastra/core/observability';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { initLogger } from 'braintrust';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BraintrustExporter } from './tracing';
import type { BraintrustExporterConfig } from './tracing';

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
      const invalidConfig = {
        // Missing apiKey
        endpoint: 'https://test.com',
      };

      const disabledExporter = new BraintrustExporter(invalidConfig);

      // Should be disabled when apiKey is missing
      expect(disabledExporter['isDisabled']).toBe(true);

      // Should not create spans when disabled
      const rootSpan = createMockSpan({
        id: 'test-span',
        name: 'test',
        type: SpanType.GENERIC,
        isRoot: true,
        attributes: {},
      });

      await disabledExporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      });

      expect(mockInitLogger).not.toHaveBeenCalled();
    });
  });

  describe('Logger Creation', () => {
    it('should create Braintrust logger for root spans', async () => {
      const rootSpan = createMockSpan({
        id: 'root-span-id',
        name: 'root-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {
          agentId: 'agent-123',
          instructions: 'Test agent',
        },
        metadata: { userId: 'user-456', sessionId: 'session-789' },
      });

      const event: TracingEvent = {
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      };

      // Ensure traceId differs from span id
      expect(rootSpan.traceId).not.toBe(rootSpan.id);

      await exporter.exportTracingEvent(event);

      // Should create Braintrust logger with correct parameters
      expect(mockInitLogger).toHaveBeenCalledWith({
        projectName: 'mastra-tracing',
        apiKey: 'test-api-key',
        appUrl: 'https://test-braintrust.com',
        debug: true,
      });

      // Should create Braintrust span with correct type and payload
      expect(mockLogger.startSpan).toHaveBeenCalledWith({
        spanId: 'root-span-id',
        name: 'root-agent',
        type: 'task', // Default span type mapping for AGENT_RUN
        parentSpanIds: {
          spanId: rootSpan.traceId,
          rootSpanId: rootSpan.traceId,
        },
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
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      });

      vi.clearAllMocks();

      // Then create child span
      const childSpan = createMockSpan({
        id: 'child-span-id',
        name: 'child-tool',
        type: SpanType.TOOL_CALL,
        isRoot: false,
        attributes: { toolId: 'calculator' },
      });
      childSpan.traceId = rootSpan.traceId;
      childSpan.parentSpanId = 'root-span-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: childSpan,
      });

      // Should not create new logger for child spans
      expect(mockInitLogger).not.toHaveBeenCalled();

      // Should create child span on parent span
      expect(mockSpan.startSpan).toHaveBeenCalledWith({
        spanId: 'child-span-id',
        name: 'child-tool',
        type: 'tool', // TOOL_CALL maps to 'tool'
        parentSpanIds: {
          spanId: rootSpan.id,
          rootSpanId: rootSpan.traceId,
        },
        input: undefined,
        metadata: {
          spanType: 'tool_call',
          toolId: 'calculator',
        },
      });
    });
  });

  describe('Span Type Mappings', () => {
    it('should map MODEL_GENERATION to "llm" type', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-span',
        name: 'gpt-4-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: { model: 'gpt-4' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'llm',
        }),
      );
    });

    it('should map MODEL_CHUNK to "llm" type', async () => {
      const chunkSpan = createMockSpan({
        id: 'chunk-span',
        name: 'llm-chunk',
        type: SpanType.MODEL_CHUNK,
        isRoot: true,
        attributes: { chunkType: 'text-delta' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: chunkSpan,
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
        type: SpanType.TOOL_CALL,
        isRoot: true,
        attributes: { toolId: 'calc' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: toolSpan,
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
        type: SpanType.MCP_TOOL_CALL,
        isRoot: true,
        attributes: { toolId: 'file-reader', mcpServer: 'fs-server' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: mcpSpan,
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
        type: SpanType.WORKFLOW_CONDITIONAL_EVAL,
        isRoot: true,
        attributes: { conditionIndex: 0, result: true },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: condSpan,
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
        type: SpanType.WORKFLOW_WAIT_EVENT,
        isRoot: true,
        attributes: { eventName: 'user-input', timeoutMs: 30000 },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: waitSpan,
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
        type: SpanType.GENERIC,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: genericSpan,
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
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: { agentId: 'test-agent' },
      });

      vi.clearAllMocks();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: agentSpan,
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
        type: SpanType.MODEL_GENERATION,
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

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      // Ensure traceId differs from span id
      expect(llmSpan.traceId).not.toBe(llmSpan.id);

      expect(mockLogger.startSpan).toHaveBeenCalledWith({
        spanId: 'llm-span',
        name: 'gpt-4-call',
        type: 'llm',
        parentSpanIds: {
          spanId: llmSpan.traceId,
          rootSpanId: llmSpan.traceId,
        },
        input: { messages: [{ role: 'user', content: 'Hello' }] },
        output: { content: 'Hi there!' },
        metrics: {
          prompt_tokens: 10,
          completion_tokens: 5,
          tokens: 15,
        },
        metadata: {
          spanType: 'model_generation',
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
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: {
          model: 'gpt-3.5-turbo',
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      // Ensure traceId differs from span id
      expect(llmSpan.traceId).not.toBe(llmSpan.id);

      expect(mockLogger.startSpan).toHaveBeenCalledWith({
        spanId: 'minimal-llm',
        name: 'simple-llm',
        type: 'llm',
        parentSpanIds: {
          spanId: llmSpan.traceId,
          rootSpanId: llmSpan.traceId,
        },
        metadata: {
          spanType: 'model_generation',
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
        type: SpanType.TOOL_CALL,
        isRoot: true,
        attributes: { toolId: 'calc', success: false },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: toolSpan,
      });

      // Then update it
      toolSpan.attributes = {
        ...toolSpan.attributes,
        success: true,
      } as ToolCallAttributes;
      toolSpan.output = { result: 42 };

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: toolSpan,
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
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: { model: 'gpt-4' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      // Update with usage info
      llmSpan.attributes = {
        ...llmSpan.attributes,
        usage: { totalTokens: 150 },
      } as ModelGenerationAttributes;
      llmSpan.output = { content: 'Updated response' };

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: llmSpan,
      });

      expect(mockSpan.log).toHaveBeenCalledWith({
        output: { content: 'Updated response' },
        metrics: { tokens: 150 },
        metadata: {
          spanType: 'model_generation',
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
        type: SpanType.GENERIC,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: span,
      });

      span.endTime = new Date();
      span.output = { result: 'success' };

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: span,
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
        type: SpanType.TOOL_CALL,
        isRoot: true,
        attributes: { toolId: 'failing-tool' },
        errorInfo: {
          message: 'Tool execution failed',
          id: 'TOOL_ERROR',
          category: 'EXECUTION',
        },
      });

      errorSpan.endTime = new Date();

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: errorSpan,
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: errorSpan,
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
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      });

      // Verify trace was created
      expect((exporter as any).traceMap.has(rootSpan.traceId)).toBe(true);

      rootSpan.endTime = new Date();

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: rootSpan,
      });

      // Should clean up traceMap
      expect((exporter as any).traceMap.has(rootSpan.traceId)).toBe(false);
    });
  });

  describe('Event Span Handling', () => {
    it('should create zero-duration spans for root event spans', async () => {
      const eventSpan = createMockSpan({
        id: 'event-span',
        name: 'user-feedback',
        type: SpanType.GENERIC,
        isRoot: true,
        attributes: {
          eventType: 'user_feedback',
          rating: 5,
        },
        output: { message: 'Great response!' },
      });
      eventSpan.isEvent = true;

      // Ensure traceId differs from span id
      expect(eventSpan.traceId).not.toBe(eventSpan.id);

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: eventSpan,
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
        spanId: 'event-span',
        name: 'user-feedback',
        type: 'task',
        parentSpanIds: {
          spanId: eventSpan.traceId,
          rootSpanId: eventSpan.traceId,
        },
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
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      });

      // Then create child event span
      const childEventSpan = createMockSpan({
        id: 'child-event',
        name: 'tool-result',
        type: SpanType.GENERIC,
        isRoot: false,
        attributes: {
          toolName: 'calculator',
          success: true,
        },
        output: { result: 42 },
      });
      childEventSpan.isEvent = true;
      childEventSpan.traceId = rootSpan.traceId;
      childEventSpan.parentSpanId = 'root-span';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: childEventSpan,
      });

      // Should create child span on parent
      expect(mockSpan.startSpan).toHaveBeenCalledWith({
        spanId: 'child-event',
        name: 'tool-result',
        type: 'task',
        parentSpanIds: {
          spanId: rootSpan.id,
          rootSpanId: rootSpan.traceId,
        },
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
        type: SpanType.GENERIC,
        isRoot: false,
        attributes: {},
      });
      orphanEventSpan.isEvent = true;
      orphanEventSpan.traceId = 'missing-trace';

      // Should not throw
      await expect(
        exporter.exportTracingEvent({
          type: TracingEventType.SPAN_STARTED,
          exportedSpan: orphanEventSpan,
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
        type: SpanType.TOOL_CALL,
        isRoot: false,
        attributes: { toolId: 'orphan-tool' },
      });

      // Should not throw when trying to create child span without parent
      await expect(
        exporter.exportTracingEvent({
          type: TracingEventType.SPAN_STARTED,
          exportedSpan: orphanSpan,
        }),
      ).resolves.not.toThrow();

      // Should not create any spans
      expect(mockLogger.startSpan).not.toHaveBeenCalled();
    });

    it('should handle missing spans gracefully', async () => {
      const span = createMockSpan({
        id: 'missing-span',
        name: 'missing',
        type: SpanType.GENERIC,
        isRoot: true,
        attributes: {},
      });

      // Try to update non-existent span
      await expect(
        exporter.exportTracingEvent({
          type: TracingEventType.SPAN_UPDATED,
          exportedSpan: span,
        }),
      ).resolves.not.toThrow();

      // Try to end non-existent span
      await expect(
        exporter.exportTracingEvent({
          type: TracingEventType.SPAN_ENDED,
          exportedSpan: span,
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
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
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

  describe('Out-of-Order Events', () => {
    it('keeps trace until last child ends when root ends first', async () => {
      // Start root span
      const rootSpan = createMockSpan({
        id: 'root-span-oOO',
        name: 'root-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: rootSpan });

      // Start child span
      const childSpan = createMockSpan({
        id: 'child-span-oOO',
        name: 'child-step',
        type: SpanType.GENERIC,
        isRoot: false,
        attributes: { stepId: 'child-step' },
      });
      childSpan.traceId = rootSpan.traceId;
      childSpan.parentSpanId = rootSpan.id;

      await exporter.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: childSpan });

      // End root BEFORE child ends (out-of-order end sequence)
      rootSpan.endTime = new Date();
      await exporter.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: rootSpan });

      // Now end child
      childSpan.endTime = new Date();
      await exporter.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: childSpan });

      // Both Braintrust spans should be ended (root then child)
      expect(mockSpan.end).toHaveBeenCalledTimes(2);

      // Shutdown should not end anything further (cleanup already done)
      await exporter.shutdown();
      expect(mockSpan.end).toHaveBeenCalledTimes(2);
    });

    it('allows starting new child after root ended if another child is still active', async () => {
      // Start root span
      const rootSpan = createMockSpan({
        id: 'root-span-keepalive',
        name: 'root-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: rootSpan });

      // Start first child to keep the trace alive
      const childA = createMockSpan({
        id: 'child-A',
        name: 'child-A',
        type: SpanType.GENERIC,
        isRoot: false,
        attributes: { stepId: 'A' },
      });
      childA.traceId = rootSpan.traceId;
      childA.parentSpanId = rootSpan.id;
      await exporter.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: childA });

      // End root while childA is still active
      rootSpan.endTime = new Date();
      await exporter.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: rootSpan });

      // Start another child AFTER root has ended
      const childB = createMockSpan({
        id: 'child-B',
        name: 'child-B',
        type: SpanType.GENERIC,
        isRoot: false,
        attributes: { stepId: 'B' },
      });
      childB.traceId = rootSpan.traceId;
      childB.parentSpanId = rootSpan.id;
      await exporter.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: childB });

      // Finish both children
      childA.endTime = new Date();
      await exporter.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: childA });

      childB.endTime = new Date();
      await exporter.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: childB });

      // Ends: root, childA, childB
      expect(mockSpan.end).toHaveBeenCalledTimes(3);

      // Shutdown should not end anything further
      await exporter.shutdown();
      expect(mockSpan.end).toHaveBeenCalledTimes(3);
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
  type: SpanType;
  isRoot: boolean;
  attributes: any;
  metadata?: Record<string, any>;
  input?: any;
  output?: any;
  errorInfo?: any;
}): AnyExportedSpan {
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
    traceId: isRoot ? `${id}-trace` : 'parent-trace-id',
    get isRootSpan() {
      return isRoot;
    },
    parentSpanId: isRoot ? undefined : 'parent-id',
    isEvent: false,
  } as AnyExportedSpan;

  return mockSpan;
}
