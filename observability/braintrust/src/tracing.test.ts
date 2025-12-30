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
import { initLogger, _exportsForTestingOnly } from 'braintrust';
import type { Logger } from 'braintrust';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BraintrustExporter } from './tracing';
import type { BraintrustExporterConfig } from './tracing';

// Mock Braintrust initLogger function (must be at the top level)
vi.mock('braintrust');

class TestBraintrustExporter extends BraintrustExporter {
  _getTraceData(traceId: string) {
    return this.getTraceData({ traceId, method: 'test' });
  }

  get _traceMapSize(): number {
    return this.traceMapSize();
  }

  get _isDisabled(): boolean {
    return this.isDisabled;
  }
}

describe('BraintrustExporter', () => {
  // Mock objects
  let mockSpan: any;
  let mockLogger: any;
  let mockInitLogger: any;

  let exporter: TestBraintrustExporter;
  let config: BraintrustExporterConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up mocks
    mockSpan = {
      id: 'mockSpan',
      startSpan: vi.fn(),
      log: vi.fn(),
      end: vi.fn(),
    };

    // Set up circular reference for nested spans
    mockSpan.startSpan.mockReturnValue(mockSpan);

    mockLogger = {
      id: 'mockLogger',
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
      // Short cleanup delay for faster tests
      traceCleanupDelayMs: 10,
    };

    exporter = new TestBraintrustExporter(config);
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(exporter.name).toBe('braintrust');
    });

    it('should disable exporter when apiKey is missing', async () => {
      // Save and clear env var to ensure exporter is truly disabled
      const originalApiKey = process.env.BRAINTRUST_API_KEY;
      delete process.env.BRAINTRUST_API_KEY;

      try {
        const invalidConfig = {
          // Missing apiKey
          endpoint: 'https://test.com',
        };

        const disabledExporter = new TestBraintrustExporter(invalidConfig);

        // Should be disabled when apiKey is missing
        expect(disabledExporter._isDisabled).toBe(true);

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
      } finally {
        // Restore env var
        if (originalApiKey) process.env.BRAINTRUST_API_KEY = originalApiKey;
      }
    });
  });

  describe('Logger Creation', () => {
    it('should create Braintrust logger for root spans', async () => {
      const traceId = 'trace-id';

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
        traceId,
      });

      const event: TracingEvent = {
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      };

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
        // No parentSpanIds for root spans!
        startTime: rootSpan.startTime.getTime() / 1000,
        metadata: {
          spanType: 'agent_run',
          agentId: 'agent-123',
          instructions: 'Test agent',
          userId: 'user-456',
          sessionId: 'session-789',
          'mastra-trace-id': 'trace-id',
        },
      });
    });

    it('should handle logger initialization failure', async () => {
      const error = new Error('Init failed');
      mockInitLogger.mockRejectedValue(error);

      // Spy on the internal logger to verify error logging
      const loggerErrorSpy = vi.spyOn((exporter as any).logger, 'error');

      const rootSpan = createMockSpan({
        id: 'root-span-error',
        name: 'root-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      });

      expect(mockInitLogger).toHaveBeenCalled();
      expect(loggerErrorSpy).toHaveBeenCalledWith('Braintrust exporter: Failed to initialize logger', {
        error,
      });

      // Should be disabled after failure
      expect(exporter._isDisabled).toBe(true);
    });

    it('should not create logger for child spans', async () => {
      // First create root span
      const traceId = 'trace-id';
      const rootSpan = createMockSpan({
        id: 'root-span-id',
        name: 'root-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
        traceId,
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
        traceId,
      });
      childSpan.parentSpanId = rootSpan.id;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: childSpan,
      });

      // Should not create new logger for child spans
      expect(mockInitLogger).not.toHaveBeenCalled();

      // Should create child span on parent span
      // The startSpan() chain handles parent-child relationships automatically
      expect(mockSpan.startSpan).toHaveBeenCalledWith({
        spanId: 'child-span-id',
        name: 'child-tool',
        type: 'tool', // TOOL_CALL maps to 'tool'
        startTime: childSpan.startTime.getTime() / 1000,
        metadata: {
          spanType: 'tool_call',
          toolId: 'calculator',
          'mastra-trace-id': traceId,
        },
      });
    });

    it('should reuse existing trace when multiple root spans share the same traceId', async () => {
      const sharedTraceId = 'shared-trace-123';

      // First root span (e.g., first agent.stream call)
      const firstRootSpan = createMockSpan({
        id: 'root-span-1',
        name: 'agent-call-1',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {
          agentId: 'agent-123',
          instructions: 'Test agent',
        },
        metadata: { userId: 'user-456', sessionId: 'session-789' },
      });
      firstRootSpan.traceId = sharedTraceId;

      // Child span of first root
      const firstChildSpan = createMockSpan({
        id: 'child-span-1',
        name: 'tool-call-1',
        type: SpanType.TOOL_CALL,
        isRoot: false,
        attributes: { toolId: 'calculator' },
      });
      firstChildSpan.traceId = sharedTraceId;
      firstChildSpan.parentSpanId = 'root-span-1';

      // Second root span with same traceId (e.g., second agent.stream call after client-side tool)
      const secondRootSpan = createMockSpan({
        id: 'root-span-2',
        name: 'agent-call-2',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {
          agentId: 'agent-123',
          instructions: 'Test agent',
        },
        metadata: { userId: 'user-456', sessionId: 'session-789' },
      });
      secondRootSpan.traceId = sharedTraceId;

      // Child span of second root
      const secondChildSpan = createMockSpan({
        id: 'child-span-2',
        name: 'tool-call-2',
        type: SpanType.TOOL_CALL,
        isRoot: false,
        attributes: { toolId: 'search' },
      });
      secondChildSpan.traceId = sharedTraceId;
      secondChildSpan.parentSpanId = 'root-span-2';

      // Process all spans
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: firstRootSpan,
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: firstChildSpan,
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: secondRootSpan,
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: secondChildSpan,
      });

      // Should create logger only once (for the shared traceId)
      expect(mockInitLogger).toHaveBeenCalledTimes(1);

      // Access internal traceMap to verify trace data is shared
      const traceData = exporter._getTraceData(sharedTraceId);
      expect(traceData).toBeDefined();

      // All four spans should be tracked in the same trace
      expect(traceData.hasSpan({ spanId: 'root-span-1' })).toBe(true);
      expect(traceData.hasSpan({ spanId: 'child-span-1' })).toBe(true);
      expect(traceData.hasSpan({ spanId: 'root-span-2' })).toBe(true);
      expect(traceData.hasSpan({ spanId: 'child-span-2' })).toBe(true);

      // All four spans should be active
      expect(traceData.isActiveSpan({ spanId: 'root-span-1' })).toBe(true);
      expect(traceData.isActiveSpan({ spanId: 'child-span-1' })).toBe(true);
      expect(traceData.isActiveSpan({ spanId: 'root-span-2' })).toBe(true);
      expect(traceData.isActiveSpan({ spanId: 'child-span-2' })).toBe(true);
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

    it('should map MODEL_CHUNK to "task" type', async () => {
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
          type: 'task',
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
      const traceId = 'trace-id';
      const llmSpan = createMockSpan({
        id: 'llm-span',
        name: 'gpt-4-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        input: { messages: [{ role: 'user', content: 'Hello' }] },
        // Note: LLM output uses 'text' field, not 'content'
        output: { text: 'Hi there!' },
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          usage: {
            inputTokens: 10,
            outputTokens: 5,
          },
          parameters: {
            temperature: 0.7,
            maxTokens: 100,
          },
          streaming: false,
          resultType: 'response_generation',
        },
        traceId,
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith({
        spanId: 'llm-span',
        name: 'gpt-4-call',
        type: 'llm',
        // No parentSpanIds for root spans!
        // Input is transformed: { messages: [...] } -> [...] for Braintrust Thread view
        input: [{ role: 'user', content: 'Hello' }],
        // Output is transformed: { text: '...' } -> { role: 'assistant', content: '...' } for Braintrust Thread view
        output: { role: 'assistant', content: 'Hi there!' },
        startTime: llmSpan.startTime.getTime() / 1000,
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
          'mastra-trace-id': traceId,
        },
      });
    });

    it('should handle minimal LLM generation attributes', async () => {
      const traceId = 'trace-id';

      const llmSpan = createMockSpan({
        id: 'minimal-llm',
        name: 'simple-llm',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: {
          model: 'gpt-3.5-turbo',
        },
        traceId,
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith({
        spanId: 'minimal-llm',
        name: 'simple-llm',
        type: 'llm',
        startTime: llmSpan.startTime.getTime() / 1000,
        // No parentSpanIds for root spans!
        metadata: {
          spanType: 'model_generation',
          model: 'gpt-3.5-turbo',
          'mastra-trace-id': traceId,
        },
      });
    });

    /**
     * Test for GitHub issue #9848: Braintrust Thread view not showing data
     *
     * According to Braintrust documentation, the Thread view expects the `input`
     * field for LLM spans to be a direct array of messages in OpenAI format:
     *
     *   input: [{ role: 'user', content: 'Hello' }]
     *
     * NOT wrapped in an object:
     *
     *   input: { messages: [{ role: 'user', content: 'Hello' }] }
     *
     * This test verifies that the BraintrustExporter transforms the input format
     * correctly for LLM spans so the Thread view displays messages properly.
     *
     * @see https://github.com/mastra-ai/mastra/issues/9848
     * @see https://www.braintrust.dev/docs/guides/traces/customize
     */
    it('should format LLM input as direct messages array for Thread view (issue #9848)', async () => {
      // Mastra currently passes messages wrapped in an object
      const llmSpan = createMockSpan({
        id: 'thread-view-llm',
        name: 'gpt-4-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        input: { messages: [{ role: 'user', content: 'What is the weather?' }] },
        // Note: LLM output uses 'text' field, not 'content'
        output: { text: 'The weather is sunny.' },
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      // Braintrust Thread view expects:
      // - input to be a direct array of messages in OpenAI format
      // - output to be { role: 'assistant', content: '...' } format
      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          // Thread view requires direct array format for messages to display
          input: [{ role: 'user', content: 'What is the weather?' }],
          output: { role: 'assistant', content: 'The weather is sunny.' },
        }),
      );
    });
  });

  describe('AI SDK v5 Message Conversion', () => {
    it('should convert AI SDK v5 user messages to OpenAI format', async () => {
      const llmSpan = createMockSpan({
        id: 'ai-sdk-v5-user',
        name: 'llm-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        input: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: [{ type: 'text', text: 'Hello!' }] },
        ],
        output: { text: 'Hi there!' },
        attributes: { model: 'gpt-4' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: 'Hello!' },
          ],
        }),
      );
    });

    it('should convert AI SDK v5 assistant messages with tool calls to OpenAI format', async () => {
      const llmSpan = createMockSpan({
        id: 'ai-sdk-v5-tools',
        name: 'llm-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        input: [
          { role: 'user', content: [{ type: 'text', text: 'What is 2+2?' }] },
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Let me calculate.' },
              { type: 'tool-call', toolCallId: 'call_123', toolName: 'calculator', args: { a: 2, b: 2 } },
            ],
          },
        ],
        output: { text: 'The answer is 4.' },
        attributes: { model: 'gpt-4' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: [
            { role: 'user', content: 'What is 2+2?' },
            {
              role: 'assistant',
              content: 'Let me calculate.',
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: { name: 'calculator', arguments: '{"a":2,"b":2}' },
                },
              ],
            },
          ],
        }),
      );
    });

    it('should convert AI SDK v5 tool result messages to OpenAI format', async () => {
      const llmSpan = createMockSpan({
        id: 'ai-sdk-v5-tool-result',
        name: 'llm-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        input: [
          { role: 'user', content: 'Calculate 2+2' },
          {
            role: 'tool',
            content: [{ type: 'tool-result', toolCallId: 'call_123', output: { result: 4 } }],
          },
        ],
        output: { text: '4' },
        attributes: { model: 'gpt-4' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: [
            { role: 'user', content: 'Calculate 2+2' },
            { role: 'tool', content: '{"result":4}', tool_call_id: 'call_123' },
          ],
        }),
      );
    });

    it('should handle mixed OpenAI and AI SDK v5 message formats', async () => {
      const llmSpan = createMockSpan({
        id: 'mixed-formats',
        name: 'llm-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        input: [
          { role: 'system', content: 'Be helpful.' }, // Already OpenAI format
          { role: 'user', content: [{ type: 'text', text: 'Hi' }] }, // AI SDK v5 format
          { role: 'assistant', content: 'Hello!' }, // Already OpenAI format
        ],
        output: { text: 'Done' },
        attributes: { model: 'gpt-4' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: [
            { role: 'system', content: 'Be helpful.' },
            { role: 'user', content: 'Hi' },
            { role: 'assistant', content: 'Hello!' },
          ],
        }),
      );
    });

    it('should handle tool calls with input field instead of args', async () => {
      const llmSpan = createMockSpan({
        id: 'tool-input-field',
        name: 'llm-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        input: [
          {
            role: 'assistant',
            content: [{ type: 'tool-call', toolCallId: 'call_456', toolName: 'search', input: { query: 'test' } }],
          },
        ],
        output: { text: 'Found it.' },
        attributes: { model: 'gpt-4' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: [
            {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_456',
                  type: 'function',
                  function: { name: 'search', arguments: '{"query":"test"}' },
                },
              ],
            },
          ],
        }),
      );
    });

    it('should handle tool results with v4 result field instead of output', async () => {
      const llmSpan = createMockSpan({
        id: 'tool-result-v4',
        name: 'llm-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        input: [
          { role: 'user', content: 'Calculate 2+2' },
          {
            role: 'tool',
            // AI SDK v4 uses 'result' instead of 'output'
            content: [{ type: 'tool-result', toolCallId: 'call_123', result: { answer: 4, operation: 'add' } }],
          },
        ],
        output: { text: '4' },
        attributes: { model: 'gpt-4' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: [
            { role: 'user', content: 'Calculate 2+2' },
            { role: 'tool', content: '{"answer":4,"operation":"add"}', tool_call_id: 'call_123' },
          ],
        }),
      );
    });

    it('should handle empty content arrays gracefully', async () => {
      const llmSpan = createMockSpan({
        id: 'empty-content',
        name: 'llm-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        input: [
          { role: 'user', content: [] },
          { role: 'assistant', content: [] },
        ],
        output: { text: 'Response' },
        attributes: { model: 'gpt-4' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: [
            { role: 'user', content: '' },
            { role: 'assistant', content: '' },
          ],
        }),
      );
    });

    it('should handle image content parts with placeholder', async () => {
      const llmSpan = createMockSpan({
        id: 'image-content',
        name: 'llm-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        input: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is in this image?' },
              { type: 'image', image: 'base64data...', mimeType: 'image/png' },
            ],
          },
        ],
        output: { text: 'I see a cat.' },
        attributes: { model: 'gpt-4-vision' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: [{ role: 'user', content: 'What is in this image?\n[image]' }],
        }),
      );
    });

    it('should handle file content parts with filename', async () => {
      const llmSpan = createMockSpan({
        id: 'file-content',
        name: 'llm-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        input: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this document' },
              { type: 'file', filename: 'report.pdf', data: 'base64data...' },
            ],
          },
        ],
        output: { text: 'Analysis complete.' },
        attributes: { model: 'gpt-4' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: [{ role: 'user', content: 'Analyze this document\n[file: report.pdf]' }],
        }),
      );
    });

    it('should handle file content parts without filename', async () => {
      const llmSpan = createMockSpan({
        id: 'file-no-name',
        name: 'llm-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        input: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Check this file' },
              { type: 'file', data: 'base64data...' },
            ],
          },
        ],
        output: { text: 'Done.' },
        attributes: { model: 'gpt-4' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: [{ role: 'user', content: 'Check this file\n[file]' }],
        }),
      );
    });

    it('should handle reasoning content parts with text preview', async () => {
      const llmSpan = createMockSpan({
        id: 'reasoning-content',
        name: 'llm-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        input: [
          {
            role: 'assistant',
            content: [
              { type: 'reasoning', text: 'Let me think about this step by step...' },
              { type: 'text', text: 'The answer is 42.' },
            ],
          },
        ],
        output: { text: 'Done.' },
        attributes: { model: 'claude-3' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: [
            {
              role: 'assistant',
              content: '[reasoning: Let me think about this step by step...]\nThe answer is 42.',
            },
          ],
        }),
      );
    });

    it('should truncate long reasoning text in preview', async () => {
      const longReasoning = 'A'.repeat(200);
      const llmSpan = createMockSpan({
        id: 'long-reasoning',
        name: 'llm-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        input: [
          {
            role: 'assistant',
            content: [
              { type: 'reasoning', text: longReasoning },
              { type: 'text', text: 'Done.' },
            ],
          },
        ],
        output: { text: 'Done.' },
        attributes: { model: 'claude-3' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: [
            {
              role: 'assistant',
              content: `[reasoning: ${'A'.repeat(100)}...]\nDone.`,
            },
          ],
        }),
      );
    });

    it('should handle unknown content types gracefully', async () => {
      const llmSpan = createMockSpan({
        id: 'unknown-content',
        name: 'llm-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        input: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Hello' },
              { type: 'custom-type', data: 'some data' },
            ],
          },
        ],
        output: { text: 'Hi!' },
        attributes: { model: 'gpt-4' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: [{ role: 'user', content: 'Hello\n[custom-type]' }],
        }),
      );
    });

    it('should handle null/undefined tool results gracefully', async () => {
      const llmSpan = createMockSpan({
        id: 'null-tool-result',
        name: 'llm-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        input: [
          {
            role: 'tool',
            content: [{ type: 'tool-result', toolCallId: 'call_123', output: null }],
          },
        ],
        output: { text: 'Done.' },
        attributes: { model: 'gpt-4' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: [{ role: 'tool', content: '', tool_call_id: 'call_123' }],
        }),
      );
    });

    it('should handle undefined tool results (missing output/result fields)', async () => {
      const llmSpan = createMockSpan({
        id: 'undefined-tool-result',
        name: 'llm-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        input: [
          {
            role: 'tool',
            content: [{ type: 'tool-result', toolCallId: 'call_456' }], // no output or result field
          },
        ],
        output: { text: 'Done.' },
        attributes: { model: 'gpt-4' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: [{ role: 'tool', content: '', tool_call_id: 'call_456' }],
        }),
      );
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
        usage: { inputTokens: 100, outputTokens: 50 },
      } as ModelGenerationAttributes;
      // Note: LLM output uses 'text' field, not 'content'
      llmSpan.output = { text: 'Updated response' };

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: llmSpan,
      });

      expect(mockSpan.log).toHaveBeenCalledWith({
        // Output is transformed: { text: '...' } -> { role: 'assistant', content: '...' } for Braintrust Thread view
        output: { role: 'assistant', content: 'Updated response' },
        metrics: { prompt_tokens: 100, completion_tokens: 50, tokens: 150 },
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

      const traceData = exporter._getTraceData(rootSpan.traceId);

      // Verify trace was created
      expect(traceData.activeSpanCount()).toBeGreaterThan(0);

      rootSpan.endTime = new Date();

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: rootSpan,
      });

      // Wait for cleanup delay (config uses 10ms)
      await new Promise(resolve => setTimeout(resolve, 20));

      const newTraceData = exporter._getTraceData(rootSpan.traceId);

      // Trace should be cleaned up since this was the only active span
      // (traceData is always created if it doesn't exist, but the old object
      // should have been cleaned up.)
      expect(traceData).not.toBe(newTraceData);
    });
  });

  describe('Event Span Handling', () => {
    it('should create zero-duration spans for root event spans', async () => {
      const traceId = 'trace-id';

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
        traceId,
      });
      eventSpan.isEvent = true;

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
      // Root event spans should NOT have parentSpanIds
      expect(mockLogger.startSpan).toHaveBeenCalledWith({
        spanId: 'event-span',
        name: 'user-feedback',
        type: 'task',
        // No parentSpanIds for root spans!
        startTime: eventSpan.startTime.getTime() / 1000,
        output: { message: 'Great response!' },
        metadata: {
          spanType: 'generic',
          eventType: 'user_feedback',
          rating: 5,
          'mastra-trace-id': traceId,
        },
      });

      // Should immediately end with same timestamp
      expect(mockSpan.end).toHaveBeenCalledWith({ endTime: eventSpan.startTime.getTime() / 1000 });
    });

    it('should create zero-duration child spans for child event spans', async () => {
      // First create root span
      const traceId = 'trace-id';

      const rootSpan = createMockSpan({
        id: 'root-span',
        name: 'root-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
        traceId,
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
        traceId,
      });
      childEventSpan.isEvent = true;
      childEventSpan.parentSpanId = 'root-span';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: childEventSpan,
      });

      // Should create child span on parent
      // The startSpan() chain handles parent-child relationships automatically
      expect(mockSpan.startSpan).toHaveBeenCalledWith({
        spanId: 'child-event',
        name: 'tool-result',
        type: 'task',
        startTime: childEventSpan.startTime.getTime() / 1000,
        output: { result: 42 },
        metadata: {
          spanType: 'generic',
          toolName: 'calculator',
          success: true,
          'mastra-trace-id': traceId,
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

  describe('Tags Support', () => {
    it('should include tags in span.log() for root spans with tags', async () => {
      const rootSpanWithTags = createMockSpan({
        id: 'root-with-tags',
        name: 'tagged-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: { agentId: 'agent-123' },
        tags: ['production', 'experiment-v2', 'user-request'],
      });

      const event: TracingEvent = {
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpanWithTags,
      };

      await exporter.exportTracingEvent(event);

      // Should log tags via span.log()
      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            'mastra-trace-id': rootSpanWithTags.traceId,
          }),
          tags: ['production', 'experiment-v2', 'user-request'],
        }),
      );
    });

    it('should not include tags in span.log() when tags array is empty', async () => {
      const rootSpanEmptyTags = createMockSpan({
        id: 'root-empty-tags',
        name: 'agent-no-tags',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: { agentId: 'agent-123' },
        tags: [],
      });

      const event: TracingEvent = {
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpanEmptyTags,
      };

      await exporter.exportTracingEvent(event);
      expect(mockLogger.startSpan).toHaveBeenCalledOnce();

      // Should startSpan without tags property
      const call = mockLogger.startSpan.mock.calls[0][0];
      expect(call.tags).toBeUndefined();
    });

    it('should not include tags in span.log() when tags is undefined', async () => {
      const rootSpanNoTags = createMockSpan({
        id: 'root-no-tags',
        name: 'agent-undefined-tags',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: { agentId: 'agent-123' },
      });
      // tags is undefined by default

      const event: TracingEvent = {
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpanNoTags,
      };

      await exporter.exportTracingEvent(event);
      expect(mockLogger.startSpan).toHaveBeenCalledOnce();

      // Should startSpan without tags property
      const call = mockLogger.startSpan.mock.calls[0];
      expect(call.tags).toBeUndefined();
    });

    it('should include tags with workflow spans', async () => {
      const workflowSpanWithTags = createMockSpan({
        id: 'workflow-with-tags',
        name: 'data-processing-workflow',
        type: SpanType.WORKFLOW_RUN,
        isRoot: true,
        attributes: { workflowId: 'wf-123' },
        tags: ['batch-processing', 'priority-high'],
      });

      const event: TracingEvent = {
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: workflowSpanWithTags,
      };

      await exporter.exportTracingEvent(event);

      // Should capture tags via span.startSpan()
      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            'mastra-trace-id': workflowSpanWithTags.traceId,
          }),
          tags: ['batch-processing', 'priority-high'],
        }),
      );
    });

    it('should not include tags for child spans (only root spans get tags)', async () => {
      // First create a root span with tags
      const rootSpan = createMockSpan({
        id: 'root-span-tags',
        name: 'root-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
        tags: ['root-tag'],
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      });

      // Clear mock to check child span startSpan calls
      mockSpan.startSpan.mockClear();

      // Create child span (should not have tags even if we set them)
      // Child spans should not have tags set by the system
      // but let's verify the exporter handles it correctly even if accidentally set
      const childSpan = createMockSpan({
        id: 'child-span-tags',
        name: 'child-tool',
        type: SpanType.TOOL_CALL,
        isRoot: false,
        attributes: { toolId: 'calculator' },
        tags: ['should-not-appear'],
      });
      childSpan.traceId = rootSpan.traceId;
      childSpan.parentSpanId = 'root-span-tags';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: childSpan,
      });

      // Check that the startSpan call for child span does not include tags
      const logCall = mockSpan.startSpan.mock.calls[0][0];
      expect(logCall.tags).toBeUndefined();
    });

    it('should include tags only on initial log, not on updates or end', async () => {
      const rootSpanWithTags = createMockSpan({
        id: 'root-lifecycle-tags',
        name: 'lifecycle-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: { agentId: 'agent-123' },
        tags: ['lifecycle-tag'],
      });

      // Start span - should include tags
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpanWithTags,
      });

      // Verify initial startSpan has tags
      expect(mockLogger.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            'mastra-trace-id': rootSpanWithTags.traceId,
          }),
          tags: ['lifecycle-tag'],
        }),
      );

      // Clear mock for update
      mockSpan.log.mockClear();

      // Update span
      rootSpanWithTags.output = { result: 'updated' };
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: rootSpanWithTags,
      });

      expect(mockSpan.log).toHaveBeenCalledOnce();

      // Update log should NOT include tags (tags are only sent once on start)
      const updateLogCall = mockSpan.log.mock.calls[0][0];
      expect(updateLogCall.tags).toBeUndefined();
      expect(updateLogCall.output).toEqual({ result: 'updated' });

      // Clear mock for end
      mockSpan.log.mockClear();

      // End span
      rootSpanWithTags.endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: rootSpanWithTags,
      });

      expect(mockSpan.log).toHaveBeenCalledOnce();

      // End log should NOT include tags
      const endLogCall = mockSpan.log.mock.calls[0][0];
      expect(endLogCall.tags).toBeUndefined();
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
      expect(exporter._traceMapSize).toBeGreaterThan(0);

      // Shutdown
      await exporter.shutdown();

      // TODO: figure out what we want to do on shutdown if open
      // spans exist.
      // Ideally end all open spans with some error message.
      //
      // Verify all spans were ended
      // expect(mockSpan.end).toHaveBeenCalled();

      // Verify maps were cleared
      expect(exporter._traceMapSize).toBe(0);
    });

    it('should handle shutdown when exporter is disabled', async () => {
      const disabledExporter = new BraintrustExporter({});

      // Should not throw
      await expect(disabledExporter.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Span Nesting (SDK handles parent-child relationships)', () => {
    it('should NOT set parentSpanIds - SDK startSpan() chain handles nesting', async () => {
      // Create root span
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

      // Root span should not have parentSpanIds
      const rootStartSpanCall = mockLogger.startSpan.mock.calls[0][0];
      expect(rootStartSpanCall.parentSpanIds).toBeUndefined();

      vi.clearAllMocks();

      // Create child span
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

      // Child span should also not have parentSpanIds - SDK handles it via startSpan() chain
      const childStartSpanCall = mockSpan.startSpan.mock.calls[0][0];
      expect(childStartSpanCall.parentSpanIds).toBeUndefined();
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

// ==============================================================================
// Tests: braintrustLogger Parameter
// ==============================================================================
// These tests verify the braintrustLogger parameter integration works correctly.

describe('BraintrustExporter with braintrustLogger parameter', () => {
  let mockLogger: any;
  let mockExternalSpan: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up mock logger
    mockLogger = {
      startSpan: vi.fn(),
    };

    // Set up mock external span (simulating logger.traced() or Eval context)
    mockExternalSpan = {
      id: 'external-span-id',
      startSpan: vi.fn(),
      log: vi.fn(),
      end: vi.fn(),
    };
  });

  it('should use provided logger when no external span exists', async () => {
    // Set up mock span that will be returned
    const mockSpan = {
      startSpan: vi.fn(),
      log: vi.fn(),
      end: vi.fn(),
    };
    mockSpan.startSpan.mockReturnValue(mockSpan);
    mockLogger.startSpan.mockReturnValue(mockSpan);

    // Create exporter with braintrustLogger parameter
    const config: BraintrustExporterConfig = {
      braintrustLogger: mockLogger as Logger<true>,
    };
    const exporter = new TestBraintrustExporter(config);

    // Verify initLogger was NOT called (because braintrustLogger is provided)
    const mockInitLogger = vi.mocked(initLogger);
    expect(mockInitLogger).not.toHaveBeenCalled();

    // Create and export a root span
    const rootSpan = createMockSpan({
      id: 'root-span-id',
      name: 'root-agent',
      type: SpanType.AGENT_RUN,
      isRoot: true,
      attributes: { agentId: 'test-agent' },
    });

    await exporter.exportTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: rootSpan,
    });

    // Verify the provided logger was used to create the span
    expect(mockLogger.startSpan).toHaveBeenCalledWith({
      spanId: 'root-span-id',
      name: 'root-agent',
      type: 'task',
      startTime: rootSpan.startTime.getTime() / 1000,
      // No parentSpanIds for root spans!
      metadata: {
        spanType: 'agent_run',
        agentId: 'test-agent',
        'mastra-trace-id': rootSpan.traceId,
      },
    });

    // Verify the trace built off the passed logger
    const traceData = exporter._getTraceData(rootSpan.traceId);
    expect(traceData).toBeDefined();
    expect(traceData.getRoot()).toBe(mockLogger);
  });

  it('should attach to external span when detected via currentSpan()', async () => {
    // Mock currentSpan to return an external span (simulating logger.traced() or Eval context)
    const { currentSpan: realCurrentSpan } = await import('braintrust');
    const mockedCurrentSpan = vi.mocked(realCurrentSpan);

    // Set up mock external span
    mockExternalSpan.startSpan.mockReturnValue(mockExternalSpan);
    mockedCurrentSpan.mockReturnValue(mockExternalSpan);

    // Create exporter with braintrustLogger parameter
    const config: BraintrustExporterConfig = {
      braintrustLogger: mockLogger as Logger<true>,
    };
    const exporter = new TestBraintrustExporter(config);
    const traceId = 'trace-id';

    // Create a Mastra root span
    const rootSpan = createMockSpan({
      id: 'mastra-span-id',
      name: 'mastra-agent',
      type: SpanType.AGENT_RUN,
      isRoot: true,
      attributes: { agentId: 'test-agent' },
      traceId,
    });

    // Export the span - should detect external span and attach to it
    await exporter.exportTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: rootSpan,
    });

    // Verify currentSpan was called to detect external context
    expect(mockedCurrentSpan).toHaveBeenCalled();

    // Verify the external span was used (not the provided logger)
    expect(mockExternalSpan.startSpan).toHaveBeenCalledWith({
      spanId: 'mastra-span-id',
      name: 'mastra-agent',
      type: 'task',
      startTime: rootSpan.startTime.getTime() / 1000,
      // When attaching to external span, parentSpanIds should be omitted
      // (checked by NOT having parentSpanIds in the call)
      metadata: {
        spanType: 'agent_run',
        agentId: 'test-agent',
        'mastra-trace-id': traceId,
      },
    });

    // Verify externalSpan is the root of the trace
    const traceData = exporter._getTraceData(rootSpan.traceId);
    expect(traceData).toBeDefined();
    expect(traceData.getRoot()).toBe(mockExternalSpan);
  });

  it('should nest child spans correctly with external parent', async () => {
    // Mock currentSpan to return an external span
    const { currentSpan: realCurrentSpan } = await import('braintrust');
    const mockedCurrentSpan = vi.mocked(realCurrentSpan);

    // Set up mock external span with child span support
    const mockChildSpan = {
      startSpan: vi.fn(),
      log: vi.fn(),
      end: vi.fn(),
    };
    mockChildSpan.startSpan.mockReturnValue(mockChildSpan); // Allow nested spans
    mockExternalSpan.startSpan.mockReturnValue(mockChildSpan);
    mockedCurrentSpan.mockReturnValue(mockExternalSpan);

    // Create exporter with braintrustLogger parameter
    const config: BraintrustExporterConfig = {
      braintrustLogger: mockLogger as Logger<true>,
    };
    const exporter = new TestBraintrustExporter(config);
    const traceId = 'trace-id';

    // Create parent and child Mastra spans
    const parentSpan = createMockSpan({
      id: 'parent-span-id',
      name: 'parent-agent',
      type: SpanType.AGENT_RUN,
      isRoot: true,
      attributes: { agentId: 'parent-agent' },
      traceId,
    });

    const childSpan = createMockSpan({
      id: 'child-span-id',
      name: 'child-tool',
      type: SpanType.TOOL_CALL,
      isRoot: false,
      attributes: { toolId: 'calculator' },
      traceId,
    });
    childSpan.parentSpanId = parentSpan.id;

    // Export parent span (should attach to external span)
    await exporter.exportTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: parentSpan,
    });

    // Export child span (should nest inside parent)
    await exporter.exportTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: childSpan,
    });

    // Verify parent was attached to external span without parentSpanIds
    expect(mockExternalSpan.startSpan).toHaveBeenCalledWith({
      spanId: 'parent-span-id',
      name: 'parent-agent',
      type: 'task',
      startTime: parentSpan.startTime.getTime() / 1000,
      metadata: {
        spanType: 'agent_run',
        agentId: 'parent-agent',
        'mastra-trace-id': traceId,
      },
    });

    // Verify child span was created WITHOUT parentSpanIds
    // In external contexts, the startSpan() chain handles parent-child relationships
    expect(mockChildSpan.startSpan).toHaveBeenCalledWith({
      spanId: 'child-span-id',
      name: 'child-tool',
      type: 'tool',
      startTime: childSpan.startTime.getTime() / 1000,
      // No parentSpanIds in external context - startSpan() chain handles relationships
      metadata: {
        spanType: 'tool_call',
        toolId: 'calculator',
        'mastra-trace-id': traceId,
      },
    });
  });

  it('should properly nest multiple levels of spans in external context via startSpan() chain', async () => {
    // This test verifies that in external contexts:
    // 1. Each span's startSpan() is called on the correct parent (not always the external span)
    // 2. No parentSpanIds is passed (startSpan() chain handles relationships)
    // 3. The span hierarchy is: external -> agent -> llm -> tool

    const { currentSpan: realCurrentSpan } = await import('braintrust');
    const mockedCurrentSpan = vi.mocked(realCurrentSpan);

    // Create mock spans for each level with tracking of which span called startSpan
    const mockToolSpan = {
      startSpan: vi.fn(),
      log: vi.fn(),
      end: vi.fn(),
    };

    const mockLlmSpan = {
      startSpan: vi.fn().mockReturnValue(mockToolSpan),
      log: vi.fn(),
      end: vi.fn(),
    };

    const mockAgentSpan = {
      startSpan: vi.fn().mockReturnValue(mockLlmSpan),
      log: vi.fn(),
      end: vi.fn(),
    };

    // External span (from Eval or logger.traced())
    const mockExternalSpan = {
      id: 'external-span-id',
      startSpan: vi.fn().mockReturnValue(mockAgentSpan),
      log: vi.fn(),
      end: vi.fn(),
    };

    mockedCurrentSpan.mockReturnValue(mockExternalSpan as any);

    const config: BraintrustExporterConfig = {
      braintrustLogger: mockLogger as Logger<true>,
      logLevel: 'debug',
    };
    const exporter = new TestBraintrustExporter(config);
    const traceId = 'trace-id';

    // Create Mastra span hierarchy: agent -> llm -> tool
    const agentSpan = createMockSpan({
      id: 'agent-span-id',
      name: 'test-agent',
      type: SpanType.AGENT_RUN,
      isRoot: true,
      attributes: { agentId: 'test-agent' },
      traceId,
    });

    const llmSpan = createMockSpan({
      id: 'llm-span-id',
      name: 'gpt-4-call',
      type: SpanType.MODEL_GENERATION,
      isRoot: false,
      attributes: { model: 'gpt-4' },
      traceId,
    });
    llmSpan.parentSpanId = agentSpan.id;

    const toolSpan = createMockSpan({
      id: 'tool-span-id',
      name: 'calculator',
      type: SpanType.TOOL_CALL,
      isRoot: false,
      attributes: { toolId: 'calc' },
      traceId,
    });
    toolSpan.parentSpanId = llmSpan.id;

    // Export spans in order
    await exporter.exportTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: agentSpan,
    });

    await exporter.exportTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: llmSpan,
    });

    await exporter.exportTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: toolSpan,
    });

    // Verify the startSpan() chain:
    // 1. Agent span should be created on the EXTERNAL span
    expect(mockExternalSpan.startSpan).toHaveBeenCalledTimes(1);
    expect(mockExternalSpan.startSpan).toHaveBeenCalledWith({
      spanId: 'agent-span-id',
      name: 'test-agent',
      type: 'task',
      startTime: agentSpan.startTime.getTime() / 1000,
      // No parentSpanIds in external context
      metadata: {
        spanType: 'agent_run',
        agentId: 'test-agent',
        'mastra-trace-id': traceId,
      },
    });

    // 2. LLM span should be created on the AGENT span (not external)
    expect(mockAgentSpan.startSpan).toHaveBeenCalledTimes(1);
    expect(mockAgentSpan.startSpan).toHaveBeenCalledWith({
      spanId: 'llm-span-id',
      name: 'gpt-4-call',
      type: 'llm',
      startTime: llmSpan.startTime.getTime() / 1000,
      metadata: {
        spanType: 'model_generation',
        model: 'gpt-4',
        'mastra-trace-id': traceId,
      },
    });

    // 3. Tool span should be created on the LLM span (not agent, not external)
    expect(mockLlmSpan.startSpan).toHaveBeenCalledTimes(1);
    expect(mockLlmSpan.startSpan).toHaveBeenCalledWith({
      spanId: 'tool-span-id',
      name: 'calculator',
      type: 'tool',
      startTime: toolSpan.startTime.getTime() / 1000,
      metadata: {
        spanType: 'tool_call',
        toolId: 'calc',
        'mastra-trace-id': traceId,
      },
    });

    // Verify trace is external
    const traceData = exporter._getTraceData(agentSpan.traceId);

    // Verify spans are stored correctly in spanData.spans
    // This proves getBraintrustParent() can find the right parent for each child
    expect(traceData.activeSpanCount()).toBe(3);
    expect(traceData.getSpan({ spanId: 'agent-span-id' })).toBe(mockAgentSpan);
    expect(traceData.getSpan({ spanId: 'llm-span-id' })).toBe(mockLlmSpan);
    expect(traceData.getSpan({ spanId: 'tool-span-id' })).toBe(mockToolSpan);

    // The key proof of correct nesting:
    // - mockAgentSpan was returned by mockExternalSpan.startSpan()
    // - mockLlmSpan was returned by mockAgentSpan.startSpan()
    // - mockToolSpan was returned by mockLlmSpan.startSpan()
    // So when we verify mockAgentSpan.startSpan was called (not mockExternalSpan),
    // it proves getBraintrustParent() returned mockAgentSpan (not external),
    // which means it correctly looked up the agent span from spanData.spans
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
  tags,
  traceId,
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
  tags?: string[];
  traceId?: string;
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
    tags,
    startTime: new Date(),
    endTime: undefined,
    traceId: traceId ?? (isRoot ? id : 'parent-trace-id'),
    get isRootSpan() {
      return isRoot;
    },
    parentSpanId: isRoot ? undefined : 'parent-id',
    isEvent: false,
  } as AnyExportedSpan;

  return mockSpan;
}
