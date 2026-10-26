/**
 * LangSmith Exporter Tests
 *
 * These tests focus on LangSmith-specific functionality:
 * - LangSmith client interactions and RunTree creation
 * - Mapping logic (spans -> LangSmith RunTrees with correct types)
 * - Event handling as zero-duration RunTrees
 * - Type-specific metadata extraction and usage metrics
 * - LangSmith-specific error handling
 */

import type {
  TracingEvent,
  AnyExportedSpan,
  ModelGenerationAttributes,
  ToolCallAttributes,
} from '@mastra/core/observability';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { Client, RunTree } from 'langsmith';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LangSmithExporter, langsmithRunIdFor } from './tracing';
import type { LangSmithExporterConfig } from './tracing';

// Mock LangSmith (must be at the top level)
vi.mock('langsmith');

class TestLangSmithExporter extends LangSmithExporter {
  _getTraceData(traceId: string) {
    return this.getTraceData({ traceId, method: 'test' });
  }

  get _traceMapSize(): number {
    return this.traceMapSize();
  }
}

describe('TestLangSmithExporter', () => {
  // Mock objects
  let mockRunTree: any;
  let mockClient: any;
  let MockRunTreeClass: any;
  let MockClientClass: any;

  let exporter: TestLangSmithExporter;
  let config: LangSmithExporterConfig;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Set up mocks for RunTree
    mockRunTree = {
      id: 'ls-run-uuid',
      createChild: vi.fn(),
      postRun: vi.fn().mockResolvedValue(undefined),
      patchRun: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
      addEvent: vi.fn(),
      inputs: {},
      outputs: {},
      metadata: {},
      error: undefined,
    };

    // Set up circular reference for child RunTrees
    mockRunTree.createChild.mockReturnValue(mockRunTree);

    // Mock RunTree constructor
    MockRunTreeClass = vi.mocked(RunTree);
    MockRunTreeClass.mockImplementation(function () {
      return mockRunTree;
    });

    // Set up mock for Client
    mockClient = {
      createRun: vi.fn(),
      updateRun: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      awaitPendingTraceBatches: vi.fn().mockResolvedValue(undefined),
    };

    MockClientClass = vi.mocked(Client);
    MockClientClass.mockImplementation(function () {
      return mockClient;
    });

    config = {
      apiKey: 'test-api-key',
      apiUrl: 'https://test-langsmith.com',
      logLevel: 'debug' as const,
      // Short cleanup delay for faster tests
      traceCleanupDelayMs: 10,
    };

    exporter = new TestLangSmithExporter(config);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(exporter.name).toBe('langsmith');
    });

    it('should pass projectName to RunTree when configured', async () => {
      // Create exporter with custom projectName
      const exporterWithProject = new TestLangSmithExporter({
        apiKey: 'test-api-key',
        projectName: 'my-custom-project',
      });

      const rootSpan = createMockSpan({
        id: 'test-span',
        name: 'test',
        type: SpanType.GENERIC,
        isRoot: true,
        attributes: {},
      });

      await exporterWithProject.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      });

      // Should pass project_name to the RunTree constructor
      expect(MockRunTreeClass).toHaveBeenCalledWith(
        expect.objectContaining({
          project_name: 'my-custom-project',
        }),
      );
    });

    it('should disable exporter when apiKey is missing', async () => {
      // Temporarily clear env var to test missing apiKey behavior
      const originalEnvKey = process.env.LANGSMITH_API_KEY;
      delete process.env.LANGSMITH_API_KEY;

      const invalidConfig = {
        // Missing apiKey
        apiUrl: 'https://test.com',
      };

      const disabledExporter = new TestLangSmithExporter(invalidConfig);

      // Restore env var safely (avoid setting to string "undefined")
      if (originalEnvKey !== undefined) {
        process.env.LANGSMITH_API_KEY = originalEnvKey;
      }

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

      expect(MockRunTreeClass).not.toHaveBeenCalled();
    });
  });

  describe('RunTree Creation', () => {
    it('should create LangSmith RunTree for root spans', async () => {
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

      await exporter.exportTracingEvent(event);

      // Should create LangSmith RunTree with correct configuration
      expect(MockRunTreeClass).toHaveBeenCalledWith({
        id: langsmithRunIdFor('root-span-id'),
        name: 'root-agent',
        run_type: 'chain', // Default span type mapping for AGENT_RUN
        client: mockClient,
        start_time: rootSpan.startTime.getTime(),
        metadata: {
          mastra_span_type: 'agent_run',
          mastra_span_id: 'root-span-id',
          mastra_trace_id: 'root-span-id',
          agentId: 'agent-123',
          instructions: 'Test agent',
          userId: 'user-456',
          sessionId: 'session-789',
          session_id: 'session-789',
        },
      });

      // Should post the run to LangSmith
      expect(mockRunTree.postRun).toHaveBeenCalled();
    });

    it('should create child RunTree for child spans', async () => {
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

      // Store the call count after root span creation
      const rootCallCount = MockRunTreeClass.mock.calls.length;

      // Then create child span
      const childSpan = createMockSpan({
        id: 'child-span-id',
        name: 'child-tool',
        type: SpanType.TOOL_CALL,
        isRoot: false,
        attributes: { toolId: 'calculator' },
      });
      childSpan.traceId = 'root-span-id';
      childSpan.parentSpanId = 'root-span-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: childSpan,
      });

      // Should not create new RunTree class instance for child spans (uses createChild instead)
      expect(MockRunTreeClass).toHaveBeenCalledTimes(rootCallCount); // Same as root span count

      // Should create child RunTree on parent
      expect(mockRunTree.createChild).toHaveBeenCalledWith({
        id: langsmithRunIdFor('child-span-id'),
        name: 'child-tool',
        run_type: 'tool', // TOOL_CALL maps to 'tool'
        client: mockClient,
        start_time: childSpan.startTime.getTime(),
        metadata: {
          mastra_span_type: 'tool_call',
          mastra_span_id: 'child-span-id',
          mastra_trace_id: 'root-span-id',
          toolId: 'calculator',
        },
      });

      // Should post the child run
      expect(mockRunTree.postRun).toHaveBeenCalledTimes(2);
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

      // Process both root spans
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: firstRootSpan,
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: secondRootSpan,
      });

      // Access internal traceMap to verify trace data is shared (not overwritten)
      const traceData = exporter._getTraceData(sharedTraceId);
      expect(traceData).toBeDefined();

      // Both root spans should be tracked in the same trace
      expect(traceData.hasSpan({ spanId: 'root-span-1' })).toBe(true);
      expect(traceData.hasSpan({ spanId: 'root-span-2' })).toBe(true);

      // Both root spans should be active
      expect(traceData.isActiveSpan({ spanId: 'root-span-1' })).toBe(true);
      expect(traceData.isActiveSpan({ spanId: 'root-span-2' })).toBe(true);
    });

    it('should pass tags to RunTree for root spans', async () => {
      const rootSpan = createMockSpan({
        id: 'root-with-tags',
        name: 'tagged-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
        tags: ['production', 'test-run'],
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      });

      expect(MockRunTreeClass).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['production', 'test-run'],
        }),
      );
    });

    it('should not pass tags to RunTree for non-root spans', async () => {
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

      // Then create child span with tags (should not be passed)
      const childSpan = createMockSpan({
        id: 'child-span',
        name: 'child-tool',
        type: SpanType.TOOL_CALL,
        isRoot: false,
        attributes: {},
        tags: ['should-not-appear'],
      });
      childSpan.traceId = 'root-span';
      childSpan.parentSpanId = 'root-span';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: childSpan,
      });

      // Child should not have tags property
      expect(mockRunTree.createChild).toHaveBeenCalledWith(
        expect.not.objectContaining({
          tags: expect.anything(),
        }),
      );
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

      expect(MockRunTreeClass).toHaveBeenCalledWith(
        expect.objectContaining({
          run_type: 'llm',
        }),
      );
    });

    it('should map MODEL_CHUNK to "chain" type', async () => {
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

      expect(MockRunTreeClass).toHaveBeenCalledWith(
        expect.objectContaining({
          run_type: 'chain',
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

      expect(MockRunTreeClass).toHaveBeenCalledWith(
        expect.objectContaining({
          run_type: 'tool',
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

      expect(MockRunTreeClass).toHaveBeenCalledWith(
        expect.objectContaining({
          run_type: 'tool',
        }),
      );
    });

    it('should map WORKFLOW_CONDITIONAL_EVAL to "chain" type', async () => {
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

      expect(MockRunTreeClass).toHaveBeenCalledWith(
        expect.objectContaining({
          run_type: 'chain',
        }),
      );
    });

    it('should map WORKFLOW_WAIT_EVENT to "chain" type', async () => {
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

      expect(MockRunTreeClass).toHaveBeenCalledWith(
        expect.objectContaining({
          run_type: 'chain',
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

      expect(MockRunTreeClass).toHaveBeenCalledWith(
        expect.objectContaining({
          run_type: 'chain',
        }),
      );

      // Test other span types that should default to 'chain'
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

      expect(MockRunTreeClass).toHaveBeenCalledWith(
        expect.objectContaining({
          run_type: 'chain',
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
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(MockRunTreeClass).toHaveBeenCalledWith({
        id: langsmithRunIdFor('llm-span'),
        name: 'gpt-4-call',
        run_type: 'llm',
        client: mockClient,
        start_time: llmSpan.startTime.getTime(),
        inputs: { messages: [{ role: 'user', content: 'Hello' }] },
        outputs: { content: 'Hi there!' },
        metadata: {
          mastra_span_type: 'model_generation',
          mastra_span_id: 'llm-span',
          mastra_trace_id: 'llm-span',
          ls_model_name: 'gpt-4',
          ls_provider: 'openai',
          usage_metadata: {
            input_tokens: 10,
            output_tokens: 5,
            total_tokens: 15,
          },
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

      expect(MockRunTreeClass).toHaveBeenCalledWith({
        id: langsmithRunIdFor('minimal-llm'),
        name: 'simple-llm',
        run_type: 'llm',
        client: mockClient,
        start_time: llmSpan.startTime.getTime(),
        metadata: {
          mastra_span_type: 'model_generation',
          mastra_span_id: 'minimal-llm',
          mastra_trace_id: 'minimal-llm',
          ls_model_name: 'gpt-3.5-turbo',
          usage_metadata: {},
        },
      });
    });
  });

  describe('Time to First Token (TTFT)', () => {
    it('should add new_token event for MODEL_GENERATION spans with completionStartTime', async () => {
      const completionStartTime = new Date('2024-01-15T10:00:00.150Z');

      const llmSpan = createMockSpan({
        id: 'llm-streaming',
        name: 'streaming-llm',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: {
          model: 'gpt-4',
          streaming: true,
          completionStartTime,
        },
      });

      // Start the span
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      // End the span (this is when addEvent is called)
      llmSpan.endTime = new Date('2024-01-15T10:00:01.000Z');
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: llmSpan,
      });

      // Should add new_token event with correct timestamp
      expect(mockRunTree.addEvent).toHaveBeenCalledWith({
        name: 'new_token',
        time: completionStartTime.toISOString(),
      });
    });

    it('should not add new_token event for MODEL_GENERATION spans without completionStartTime', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-non-streaming',
        name: 'non-streaming-llm',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: {
          model: 'gpt-4',
          streaming: false,
        },
      });

      // Start the span
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      // End the span
      llmSpan.endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: llmSpan,
      });

      // Should not add new_token event
      expect(mockRunTree.addEvent).not.toHaveBeenCalled();
    });

    it('should not add new_token event for non-MODEL_GENERATION spans', async () => {
      const toolSpan = createMockSpan({
        id: 'tool-span',
        name: 'calculator',
        type: SpanType.TOOL_CALL,
        isRoot: true,
        attributes: { toolId: 'calc' },
      });

      // Start the span
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: toolSpan,
      });

      // End the span
      toolSpan.endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: toolSpan,
      });

      // Should not add new_token event
      expect(mockRunTree.addEvent).not.toHaveBeenCalled();
    });
  });

  describe('RunTree Updates', () => {
    it('should update existing RunTrees', async () => {
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

      // Should update the RunTree properties
      expect(mockRunTree.outputs).toEqual({ result: 42 });
      expect(mockRunTree.metadata).toEqual(
        expect.objectContaining({
          mastra_span_type: 'tool_call',
          toolId: 'calc',
          success: true,
        }),
      );
    });

    it('should update LLM generation RunTrees', async () => {
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
      llmSpan.output = { content: 'Updated response' };

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: llmSpan,
      });

      // Should update the RunTree properties
      expect(mockRunTree.outputs).toEqual({ content: 'Updated response' });
      expect(mockRunTree.metadata).toEqual(
        expect.objectContaining({
          mastra_span_type: 'model_generation',
          ls_model_name: 'gpt-4',
          usage_metadata: {
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
          },
        }),
      );
    });

    it('should not patch on update, only once on end with the final output', async () => {
      const span = createMockSpan({
        id: 'update-then-end',
        name: 'test',
        type: SpanType.GENERIC,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: span,
      });

      span.output = { text: 'partial' };
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: span,
      });

      expect(mockRunTree.patchRun).not.toHaveBeenCalled();
      expect(mockRunTree.outputs).toEqual({ text: 'partial' });

      span.endTime = new Date();
      span.output = { text: 'final' };
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: span,
      });

      expect(mockRunTree.patchRun).toHaveBeenCalledTimes(1);
      expect(mockRunTree.outputs).toEqual({ text: 'final' });
    });
  });

  describe('RunTree Ending', () => {
    it('should end RunTree and patch final data', async () => {
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

      // Should update final data
      expect(mockRunTree.outputs).toEqual({ result: 'success' });
      expect(mockRunTree.metadata).toEqual(
        expect.objectContaining({
          mastra_span_type: 'generic',
        }),
      );

      // Should end the RunTree
      expect(mockRunTree.end).toHaveBeenCalledWith({ endTime: span.endTime.getTime() });
      expect(mockRunTree.patchRun).toHaveBeenCalled();
    });

    it('should handle RunTrees with error information', async () => {
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

      // Should set error information
      expect(mockRunTree.error).toBe('Tool execution failed');
      expect(mockRunTree.metadata).toEqual(
        expect.objectContaining({
          mastra_span_type: 'tool_call',
          toolId: 'failing-tool',
          errorDetails: {
            message: 'Tool execution failed',
            id: 'TOOL_ERROR',
            category: 'EXECUTION',
          },
        }),
      );

      expect(mockRunTree.end).toHaveBeenCalledWith({ endTime: errorSpan.endTime.getTime() });
      expect(mockRunTree.patchRun).toHaveBeenCalled();
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
      expect(exporter._traceMapSize).toBeGreaterThan(0);

      rootSpan.endTime = new Date();

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: rootSpan,
      });

      // Wait for cleanup delay (config uses 10ms)
      await vi.advanceTimersByTimeAsync(20);

      // Should clean up traceMap
      expect(exporter._traceMapSize).toBe(0);
    });
  });

  describe('Event Span Handling', () => {
    it('should create zero-duration RunTrees for root event spans', async () => {
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

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: eventSpan,
      });

      // Should create RunTree for root event
      expect(MockRunTreeClass).toHaveBeenCalledWith({
        id: langsmithRunIdFor('event-span'),
        name: 'user-feedback',
        run_type: 'chain',
        client: mockClient,
        start_time: eventSpan.startTime.getTime(),
        outputs: { message: 'Great response!' },
        metadata: {
          mastra_span_type: 'generic',
          mastra_span_id: 'event-span',
          mastra_trace_id: 'event-span',
          eventType: 'user_feedback',
          rating: 5,
        },
      });

      // Should post the run
      expect(mockRunTree.postRun).toHaveBeenCalled();

      // Should immediately end with same timestamp
      expect(mockRunTree.end).toHaveBeenCalledWith({ endTime: eventSpan.startTime.getTime() });
      expect(mockRunTree.patchRun).toHaveBeenCalled();
    });

    it('should create zero-duration child RunTrees for child event spans', async () => {
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

      // Should create child RunTree on parent
      expect(mockRunTree.createChild).toHaveBeenCalledWith({
        id: langsmithRunIdFor('child-event'),
        name: 'tool-result',
        run_type: 'chain',
        client: mockClient,
        start_time: childEventSpan.startTime.getTime(),
        outputs: { result: 42 },
        metadata: {
          mastra_span_type: 'generic',
          mastra_span_id: 'child-event',
          mastra_trace_id: 'trace-id',
          toolName: 'calculator',
          success: true,
        },
      });

      // Should post and immediately end the child
      expect(mockRunTree.postRun).toHaveBeenCalledTimes(2);
      expect(mockRunTree.end).toHaveBeenCalledWith({ endTime: childEventSpan.startTime.getTime() });
      expect(mockRunTree.patchRun).toHaveBeenCalled();
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

      // Should not create any RunTrees
      expect(MockRunTreeClass).not.toHaveBeenCalled();
      expect(mockRunTree.createChild).not.toHaveBeenCalled();
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

      // Should not create any RunTrees
      expect(MockRunTreeClass).not.toHaveBeenCalled();
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
    it('should end all RunTrees and clear traceMap', async () => {
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

      // Verify all RunTrees were ended and patched
      expect(mockRunTree.end).toHaveBeenCalled();
      expect(mockRunTree.patchRun).toHaveBeenCalled();

      // Verify maps were cleared
      expect(exporter._traceMapSize).toBe(0);
    });

    it('should handle shutdown when exporter is disabled', async () => {
      const disabledExporter = new TestLangSmithExporter({});

      // Should not throw
      await expect(disabledExporter.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Client flushing', () => {
    function settled(promise: Promise<void>): () => boolean {
      let done = false;
      promise.then(
        () => (done = true),
        () => (done = true),
      );
      return () => done;
    }

    function held(fn: any): () => void {
      let release!: () => void;
      fn.mockReturnValue(
        new Promise<void>(resolve => {
          release = resolve;
        }),
      );
      return release;
    }

    it('should wait for client.flush() in manual flush mode', async () => {
      mockClient.manualFlushMode = true;
      const release = held(mockClient.flush);

      const flush = exporter.flush();
      const isDone = settled(flush);
      await vi.advanceTimersByTimeAsync(10);
      expect(mockClient.flush).toHaveBeenCalledTimes(1);
      expect(mockClient.awaitPendingTraceBatches).not.toHaveBeenCalled();
      expect(isDone()).toBe(false);

      release();
      await flush;
    });

    it.each(['flush', 'shutdown'] as const)(
      'should run an overlapping manual %s after the earlier client.flush() finishes',
      async method => {
        mockClient.manualFlushMode = true;
        let release!: () => void;
        mockClient.flush.mockReturnValueOnce(
          new Promise<void>(resolve => {
            release = resolve;
          }),
        );

        const first = exporter.flush();
        const second = exporter[method]();
        const isSecondDone = settled(second);
        await vi.advanceTimersByTimeAsync(10);
        // The second client.flush() must not start while the first upload is in flight
        expect(mockClient.flush).toHaveBeenCalledTimes(1);
        expect(isSecondDone()).toBe(false);

        release();
        await Promise.all([first, second]);
        expect(mockClient.flush).toHaveBeenCalledTimes(2);
      },
    );

    it('should still flush after an earlier manual flush failed', async () => {
      mockClient.manualFlushMode = true;
      mockClient.flush.mockRejectedValueOnce(new Error('upload failed'));

      await expect(exporter.flush()).rejects.toThrow('upload failed');
      await exporter.flush();
      expect(mockClient.flush).toHaveBeenCalledTimes(2);
    });

    it.each([
      { manualFlushMode: true, used: 'flush', unused: 'awaitPendingTraceBatches' },
      { manualFlushMode: false, used: 'awaitPendingTraceBatches', unused: 'flush' },
    ] as const)(
      'should pick the client method from a real Client with manualFlushMode: $manualFlushMode',
      async ({ manualFlushMode, used, unused }) => {
        const { Client: RealClient } = await vi.importActual<typeof import('langsmith')>('langsmith');
        const client = new RealClient({ apiKey: 'test-api-key', manualFlushMode });
        const usedSpy = vi.spyOn(client, used).mockResolvedValue(undefined);
        const unusedSpy = vi.spyOn(client, unused).mockResolvedValue(undefined);
        const realExporter = new TestLangSmithExporter({ apiKey: 'test-api-key', client });

        await realExporter.flush();

        expect(usedSpy).toHaveBeenCalledTimes(1);
        expect(unusedSpy).not.toHaveBeenCalled();
      },
    );

    it('should clear the run-id map when the final shutdown flush fails', async () => {
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: createMockSpan({
          id: 'root-span',
          name: 'root',
          type: SpanType.AGENT_RUN,
          isRoot: true,
          attributes: {},
          traceId: 'ab01',
        }),
      });
      mockClient.awaitPendingTraceBatches.mockRejectedValueOnce(new Error('upload failed'));
      mockClient.createFeedback = vi.fn().mockResolvedValue(undefined);
      mockClient.readProject = vi.fn().mockResolvedValue({ id: 'project-uuid' });
      const rootRunId = langsmithRunIdFor('root-span');
      mockClient.listRuns = vi.fn(async function* () {
        yield { id: rootRunId };
      });

      await expect(exporter.shutdown()).rejects.toThrow('upload failed');

      // The cached root is gone, so a trace-level score has to go through the LangSmith lookup (and still lands).
      await exporter.onScoreEvent({
        type: 'score',
        score: { traceId: 'ab01', scorerId: 'accuracy', scorerName: 'Accuracy', score: 1 },
      } as any);
      expect(mockClient.listRuns).toHaveBeenCalled();
      expect(mockClient.createFeedback.mock.calls[0][0]).toBe(rootRunId);
    });

    it('should wait for awaitPendingTraceBatches() in auto flush mode', async () => {
      const release = held(mockClient.awaitPendingTraceBatches);

      const flush = exporter.flush();
      const isDone = settled(flush);
      await vi.advanceTimersByTimeAsync(10);
      expect(mockClient.awaitPendingTraceBatches).toHaveBeenCalledTimes(1);
      expect(mockClient.flush).not.toHaveBeenCalled();
      expect(isDone()).toBe(false);

      release();
      await flush;
    });

    it('should send the aborts of open spans before shutdown resolves', async () => {
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: createMockSpan({
          id: 'root-span',
          name: 'root',
          type: SpanType.AGENT_RUN,
          isRoot: true,
          attributes: {},
        }),
      });
      const release = held(mockClient.awaitPendingTraceBatches);

      const shutdown = exporter.shutdown();
      const isDone = settled(shutdown);
      await vi.advanceTimersByTimeAsync(10);
      expect(mockRunTree.error).toBe('Observability is shutting down.');
      expect(mockRunTree.end).toHaveBeenCalledTimes(1);
      expect(mockRunTree.patchRun).toHaveBeenCalledTimes(1);
      expect(mockClient.awaitPendingTraceBatches).toHaveBeenCalledTimes(1);
      // The abort update must be queued on the client before the client is flushed
      expect(mockClient.awaitPendingTraceBatches.mock.invocationCallOrder[0]).toBeGreaterThan(
        mockRunTree.patchRun.mock.invocationCallOrder[0],
      );
      expect(isDone()).toBe(false);

      release();
      await shutdown;
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

      // Both LangSmith RunTrees should be ended (root then child)
      expect(mockRunTree.end).toHaveBeenCalledTimes(2);
      expect(mockRunTree.patchRun).toHaveBeenCalledTimes(2);

      // Shutdown should not end anything further (cleanup already done)
      await exporter.shutdown();
      expect(mockRunTree.end).toHaveBeenCalledTimes(2);
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
      expect(mockRunTree.end).toHaveBeenCalledTimes(3);
      expect(mockRunTree.patchRun).toHaveBeenCalledTimes(3);

      // Shutdown should not end anything further
      await exporter.shutdown();
      expect(mockRunTree.end).toHaveBeenCalledTimes(3);
    });
  });

  describe('Vendor Metadata', () => {
    it('should use projectName from span.metadata.langsmith when set', async () => {
      const span = createMockSpan({
        id: 'span-with-project',
        name: 'test-span',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
        metadata: {
          langsmith: {
            projectName: 'custom-project',
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: span,
      });

      expect(MockRunTreeClass).toHaveBeenCalledWith(
        expect.objectContaining({
          project_name: 'custom-project',
        }),
      );
    });

    it('should prefer vendor metadata projectName over config projectName', async () => {
      // Create a new exporter with projectName in config
      const configExporter = new TestLangSmithExporter({
        ...config,
        projectName: 'config-project',
      });

      const span = createMockSpan({
        id: 'span-override-project',
        name: 'test-span',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
        metadata: {
          langsmith: {
            projectName: 'override-project',
          },
        },
      });

      await configExporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: span,
      });

      expect(MockRunTreeClass).toHaveBeenCalledWith(
        expect.objectContaining({
          project_name: 'override-project',
        }),
      );
    });

    it('should add session_id and session_name to metadata when set', async () => {
      const span = createMockSpan({
        id: 'span-with-session',
        name: 'test-span',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
        metadata: {
          langsmith: {
            sessionId: 'session-123',
            sessionName: 'My Session',
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: span,
      });

      expect(MockRunTreeClass).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            session_id: 'session-123',
            session_name: 'My Session',
          }),
        }),
      );
    });

    it('should omit langsmith key from final metadata', async () => {
      const span = createMockSpan({
        id: 'span-clean-metadata',
        name: 'test-span',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
        metadata: {
          customField: 'custom-value',
          langsmith: {
            projectName: 'my-project',
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: span,
      });

      expect(MockRunTreeClass).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            customField: 'custom-value',
            mastra_span_type: 'agent_run',
          }),
        }),
      );

      // Should NOT contain langsmith key
      const call = MockRunTreeClass.mock.calls[0][0];
      expect(call.metadata.langsmith).toBeUndefined();
    });

    it('should handle all vendor metadata fields together', async () => {
      const configExporter = new TestLangSmithExporter({
        ...config,
        projectName: 'default-project',
      });

      const span = createMockSpan({
        id: 'span-all-vendor',
        name: 'test-span',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
        tags: ['span-tag'],
        metadata: {
          userField: 'user-value',
          langsmith: {
            projectName: 'custom-project',
            sessionId: 'session-456',
            sessionName: 'Full Test Session',
          },
        },
      });

      await configExporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: span,
      });

      expect(MockRunTreeClass).toHaveBeenCalledWith(
        expect.objectContaining({
          project_name: 'custom-project',
          tags: ['span-tag'],
          metadata: expect.objectContaining({
            userField: 'user-value',
            session_id: 'session-456',
            session_name: 'Full Test Session',
            mastra_span_type: 'agent_run',
          }),
        }),
      );

      // Verify langsmith key is omitted
      const call = MockRunTreeClass.mock.calls[0][0];
      expect(call.metadata.langsmith).toBeUndefined();
    });
  });

  // LangSmith builds Threads only from `session_id` / `thread_id` metadata, so a memory-backed
  // conversation showed up as unrelated root runs and the Threads tab stayed empty.
  describe('Conversation threads', () => {
    const agentRun = (id: string, metadata: Record<string, any>) =>
      createMockSpan({ id, name: `agent run`, type: SpanType.AGENT_RUN, isRoot: true, attributes: {}, metadata });

    it('groups turns on one memory thread into a LangSmith Thread', async () => {
      for (const id of ['turn-1', 'turn-2']) {
        await exporter.exportTracingEvent({
          type: TracingEventType.SPAN_STARTED,
          exportedSpan: agentRun(id, { runId: id, resourceId: 'user-1', threadId: 'thread-123' }),
        });
      }

      expect(MockRunTreeClass).toHaveBeenCalledTimes(2);
      for (const [payload] of MockRunTreeClass.mock.calls) {
        expect(payload.metadata).toMatchObject({ session_id: 'thread-123', threadId: 'thread-123' });
      }
    });

    it('puts the thread session on child runs so thread filters and token counts include them', async () => {
      // The real RunTree keeps the metadata it was built with; the parent lookup reads it back.
      MockRunTreeClass.mockImplementation(function (cfg: any) {
        return { ...mockRunTree, metadata: cfg.metadata };
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: agentRun('parent-id', { runId: 'r1', threadId: 'thread-123' }),
      });
      const generation = createMockSpan({
        id: 'llm-1',
        name: 'llm',
        type: SpanType.MODEL_GENERATION,
        isRoot: false,
        attributes: { model: 'gpt-4o' },
        traceId: 'parent-id',
      });
      await exporter.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: generation });

      expect(mockRunTree.createChild).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.objectContaining({ session_id: 'thread-123' }) }),
      );
    });

    it('keeps a delegated sub-agent, which runs on a derived thread, in the conversation Thread', async () => {
      // Sub-agents get `${threadId}-${uuid}` as their own thread; the chain must still
      // carry the root session. Real RunTrees keep the metadata they were built with.
      const keepMetadata = function (cfg: any) {
        return { ...mockRunTree, metadata: cfg.metadata };
      };
      MockRunTreeClass.mockImplementation(keepMetadata);
      mockRunTree.createChild.mockImplementation(keepMetadata);

      const child = (id: string, parentSpanId: string, type: SpanType, metadata?: Record<string, any>) => ({
        ...createMockSpan({ id, name: id, type, isRoot: false, attributes: {}, metadata, traceId: 'supervisor' }),
        parentSpanId,
      });
      const chain = [
        agentRun('supervisor', { runId: 'r1', threadId: 'thread-123' }),
        child('delegate', 'supervisor', SpanType.TOOL_CALL),
        child('sub-agent', 'delegate', SpanType.AGENT_RUN, { runId: 'r2', threadId: 'thread-123-6f1c' }),
        child('sub-llm', 'sub-agent', SpanType.MODEL_GENERATION),
      ];
      for (const exportedSpan of chain) {
        await exporter.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan });
      }

      const sessions = mockRunTree.createChild.mock.calls.map(([cfg]: any[]) => cfg.metadata.session_id);
      expect(sessions).toEqual(['thread-123', 'thread-123', 'thread-123']);
    });

    it('lets an explicit withLangsmithMetadata sessionId win over the memory thread', async () => {
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: agentRun('turn-1', { threadId: 'thread-123', langsmith: { sessionId: 'session-abc' } }),
      });

      expect(MockRunTreeClass.mock.calls[0][0].metadata.session_id).toBe('session-abc');
    });

    it('prefers a plain sessionId over threadId and sends no session when neither is a string', async () => {
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: agentRun('turn-1', { sessionId: 'session-xyz', threadId: 'thread-123' }),
      });
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: agentRun('turn-2', { runId: 'r2', threadId: undefined }),
      });

      expect(MockRunTreeClass.mock.calls[0][0].metadata.session_id).toBe('session-xyz');
      expect(MockRunTreeClass.mock.calls[1][0].metadata).not.toHaveProperty('session_id');
    });
  });

  describe('onScoreEvent', () => {
    const traceId = 'trace-1';

    const scoreEvent = (overrides: Record<string, unknown>) =>
      ({
        type: 'score',
        score: { scoreId: 'sc-1', timestamp: new Date(), scorerId: 'x', score: 1, ...overrides },
      }) as any;

    const startSpan = (
      target: TestLangSmithExporter,
      id: string,
      isRoot: boolean,
      spanTraceId = traceId,
      metadata?: Record<string, any>,
    ) =>
      target.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: createMockSpan({
          id,
          name: id,
          type: SpanType.GENERIC,
          isRoot,
          attributes: {},
          traceId: spanTraceId,
          metadata,
        }),
      });

    /** LangSmith answers the root-run query with these runs (in this order). */
    const rootRunsInLangSmith = (...runs: Array<{ id: string; session_id?: string }>) => {
      mockClient.listRuns = vi.fn(async function* () {
        yield* runs;
      });
    };

    beforeEach(() => {
      exporter = new TestLangSmithExporter({ ...config, projectName: 'main' });
      mockClient.createFeedback = vi.fn().mockResolvedValue({});
      mockClient.readProject = vi.fn(async ({ projectName }: { projectName: string }) => ({
        id: `${projectName}-uuid`,
      }));
      rootRunsInLangSmith();
    });

    it('names every run after its own span id and tags runs with the Mastra ids', async () => {
      await startSpan(exporter, 'parent-id', true);
      await startSpan(exporter, 'child-span', false);

      expect(MockRunTreeClass).toHaveBeenCalledWith(
        expect.objectContaining({
          id: langsmithRunIdFor('parent-id'),
          metadata: expect.objectContaining({ mastra_span_id: 'parent-id', mastra_trace_id: traceId }),
        }),
      );
      expect(mockRunTree.createChild).toHaveBeenCalledWith(
        expect.objectContaining({ id: langsmithRunIdFor('child-span') }),
      );
    });

    // Several executions can share one Mastra trace (`tracingOptions.traceId`, resumed runs).
    // Each root must keep its own run, whichever exporter instance posts it.
    it('gives every root of a shared trace its own run id, in this exporter and in another one', async () => {
      await startSpan(exporter, 'root-a', true);
      await startSpan(exporter, 'root-b', true);
      await startSpan(new TestLangSmithExporter(config), 'root-c', true);

      const ids = MockRunTreeClass.mock.calls.map((call: any[]) => call[0].id);
      expect(ids).toEqual([langsmithRunIdFor('root-a'), langsmithRunIdFor('root-b'), langsmithRunIdFor('root-c')]);
      expect(new Set(ids).size).toBe(3);
    });

    it('scores a span without asking LangSmith, passing the project id feedback now requires', async () => {
      await startSpan(exporter, 'mastra-span-1', true);

      await exporter.onScoreEvent(
        scoreEvent({
          traceId,
          spanId: 'mastra-span-1',
          scorerId: 'accuracy',
          scorerName: 'Accuracy',
          scoreSource: 'live',
          score: 0.9,
          reason: 'good',
          metadata: { foo: 'bar' },
        }),
      );

      expect(mockClient.listRuns).not.toHaveBeenCalled();
      expect(mockClient.createFeedback).toHaveBeenCalledTimes(1);
      const [runId, key, opts] = mockClient.createFeedback.mock.calls[0];
      expect(runId).toBe(langsmithRunIdFor('mastra-span-1'));
      expect(key).toBe('Accuracy');
      expect(opts).toMatchObject({ sessionId: 'main-uuid', score: 0.9, comment: 'good', feedbackId: 'sc-1' });
      expect(opts.sourceInfo).toMatchObject({ scorerId: 'accuracy', scoreSource: 'live', foo: 'bar' });
    });

    it('does not let user metadata overwrite authoritative scorerId/scoreSource in sourceInfo', async () => {
      await exporter.onScoreEvent(
        scoreEvent({
          traceId,
          spanId: 'mastra-span-1',
          scorerId: 'accuracy',
          scoreSource: 'live',
          score: 0.9,
          metadata: { scorerId: 'evil', scoreSource: 'evil', foo: 'bar' },
        }),
      );

      const [, , opts] = mockClient.createFeedback.mock.calls.at(-1)!;
      expect(opts.sourceInfo).toMatchObject({ scorerId: 'accuracy', scoreSource: 'live', foo: 'bar' });
    });

    // The span was exported by another replica, or before a restart: nothing is cached here (#28381).
    it('scores a span that another process exported without any lookup', async () => {
      await exporter.onScoreEvent(scoreEvent({ traceId, spanId: 'other-child' }));

      expect(mockClient.listRuns).not.toHaveBeenCalled();
      expect(mockClient.createFeedback.mock.calls[0][0]).toBe(langsmithRunIdFor('other-child'));
    });

    // User feedback saved with only the Mastra traceId (#28381): must land on the trace's root run.
    it('sends a trace-level score to the root run this process exported without any lookup', async () => {
      await startSpan(exporter, 'parent-id', true);
      await startSpan(exporter, 'child-span', false);

      await exporter.onScoreEvent(scoreEvent({ traceId }));

      expect(mockClient.listRuns).not.toHaveBeenCalled();
      expect(mockClient.createFeedback.mock.calls[0][0]).toBe(langsmithRunIdFor('parent-id'));
    });

    it('sends a trace-level score to the first root when the trace has several', async () => {
      await startSpan(exporter, 'root-a', true);
      await startSpan(exporter, 'root-b', true);

      await exporter.onScoreEvent(scoreEvent({ traceId }));

      expect(mockClient.createFeedback.mock.calls[0][0]).toBe(langsmithRunIdFor('root-a'));
    });

    it('asks LangSmith for the earliest root of a trace another process exported, and caches the answer', async () => {
      rootRunsInLangSmith({ id: langsmithRunIdFor('first-root'), session_id: 'remote-uuid' });

      await exporter.onScoreEvent(scoreEvent({ traceId: 'abc123' }));
      await exporter.onScoreEvent(scoreEvent({ traceId: 'abc123', scoreId: 'sc-2' }));

      expect(mockClient.listRuns).toHaveBeenCalledTimes(1);
      expect(mockClient.listRuns.mock.calls[0][0]).toMatchObject({
        projectId: 'main-uuid',
        isRoot: true,
        order: 'asc',
        limit: 1,
        filter: `has(metadata, '{"mastra_trace_id":"abc123"}')`,
      });
      expect(mockClient.createFeedback.mock.calls.map((call: any[]) => call[0])).toEqual([
        langsmithRunIdFor('first-root'),
        langsmithRunIdFor('first-root'),
      ]);
      // The project id comes from the run LangSmith returned, not from the exporter's default project.
      expect(mockClient.createFeedback.mock.calls[0][2].sessionId).toBe('remote-uuid');
    });

    it('sends feedback with the id of the project the trace was routed to', async () => {
      await startSpan(exporter, 'root-elsewhere', true, traceId, { langsmith: { projectName: 'other' } });
      await startSpan(exporter, 'child-elsewhere', false);

      await exporter.onScoreEvent(scoreEvent({ traceId, spanId: 'child-elsewhere' }));
      await exporter.onScoreEvent(scoreEvent({ traceId, scoreId: 'sc-2' }));

      expect(mockClient.readProject).toHaveBeenCalledTimes(1);
      expect(mockClient.readProject).toHaveBeenCalledWith({ projectName: 'other' });
      expect(mockClient.createFeedback.mock.calls.map((call: any[]) => call[2].sessionId)).toEqual([
        'other-uuid',
        'other-uuid',
      ]);
    });

    it('falls back to the default project for a span whose trace this process never exported', async () => {
      await exporter.onScoreEvent(scoreEvent({ traceId: 'unknown-trace', spanId: 'remote-span' }));

      expect(mockClient.createFeedback.mock.calls[0][2].sessionId).toBe('main-uuid');
    });

    it('drops a trace-level score whose trace id is not hex without querying LangSmith', async () => {
      await exporter.onScoreEvent(scoreEvent({ traceId: "it's not a trace id" }));

      expect(mockClient.listRuns).not.toHaveBeenCalled();
      expect(mockClient.createFeedback).not.toHaveBeenCalled();
    });

    // LangSmith takes a few seconds to ingest a posted run; a score sent right after must wait.
    it('retries the root lookup until LangSmith has ingested the trace', async () => {
      let calls = 0;
      mockClient.listRuns = vi.fn(async function* () {
        if (++calls > 2) yield { id: langsmithRunIdFor('just-posted'), session_id: 'remote-uuid' };
      });

      const pending = exporter.onScoreEvent(scoreEvent({ traceId: 'beef01' }));
      await vi.advanceTimersByTimeAsync(10_000);
      await pending;

      expect(mockClient.listRuns).toHaveBeenCalledTimes(3);
      expect(mockClient.createFeedback.mock.calls[0][0]).toBe(langsmithRunIdFor('just-posted'));
    });

    it('drops a trace-level score when LangSmith still has no root run for the trace after retrying', async () => {
      const pending = exporter.onScoreEvent(scoreEvent({ traceId: 'beef01' }));
      await vi.advanceTimersByTimeAsync(10_000);
      await pending;

      // first try + 3 retries
      expect(mockClient.listRuns).toHaveBeenCalledTimes(4);
      expect(mockClient.createFeedback).not.toHaveBeenCalled();
    });

    it('drops a trace-level score when the root lookup itself fails', async () => {
      mockClient.listRuns = vi.fn(async function* () {
        throw new Error('403');
      });

      const pending = exporter.onScoreEvent(scoreEvent({ traceId: 'beef01' }));
      await vi.advanceTimersByTimeAsync(10_000);
      await pending;

      expect(mockClient.createFeedback).not.toHaveBeenCalled();
    });

    it('drops a score that names neither a trace nor a span', async () => {
      await exporter.onScoreEvent(scoreEvent({}));

      expect(mockClient.createFeedback).not.toHaveBeenCalled();
    });

    it('still sends feedback when the project id cannot be resolved', async () => {
      mockClient.readProject = vi.fn().mockRejectedValue(new Error('403'));

      await exporter.onScoreEvent(scoreEvent({ traceId, spanId: 'span-1' }));

      expect(mockClient.createFeedback).toHaveBeenCalledTimes(1);
      expect(mockClient.createFeedback.mock.calls[0][2].sessionId).toBeUndefined();
    });

    it('resolves the project id once and reuses it for later scores', async () => {
      await exporter.onScoreEvent(scoreEvent({ traceId, spanId: 'span-1' }));
      await exporter.onScoreEvent(scoreEvent({ traceId, spanId: 'span-2', scoreId: 'sc-2' }));

      expect(mockClient.readProject).toHaveBeenCalledTimes(1);
      expect(mockClient.createFeedback).toHaveBeenCalledTimes(2);
    });

    it('falls back to the LangSmith lookup once the cache has evicted a trace', async () => {
      const cappedExporter = new TestLangSmithExporter({ apiKey: 'test-api-key', runIdCacheMaxEntries: 2 });
      rootRunsInLangSmith({ id: langsmithRunIdFor('span-a') });

      // Three traces at cap=2 → the oldest (aa) is evicted from the in-memory cache.
      await startSpan(cappedExporter, 'span-a', true, 'aa');
      await startSpan(cappedExporter, 'span-b', true, 'bb');
      await startSpan(cappedExporter, 'span-c', true, 'cc');

      await cappedExporter.onScoreEvent(scoreEvent({ traceId: 'aa' }));
      expect(mockClient.listRuns).toHaveBeenCalledTimes(1);
      expect(mockClient.createFeedback.mock.calls[0][0]).toBe(langsmithRunIdFor('span-a'));

      // The found root is cached again (evicting bb); cc is still cached and needs no lookup.
      await cappedExporter.onScoreEvent(scoreEvent({ traceId: 'cc' }));
      expect(mockClient.listRuns).toHaveBeenCalledTimes(1);
      expect(mockClient.createFeedback).toHaveBeenCalledTimes(2);
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
    // Default traceId: root spans use their own ID as traceId, child spans use a shared trace ID.
    // Tests that need specific trace relationships should override these values explicitly.
    traceId: traceId ?? (isRoot ? id : 'parent-trace-id'),
    get isRootSpan() {
      return isRoot;
    },
    // Default parentSpanId: only child spans have a parent (pointing to a generic 'parent-id').
    parentSpanId: isRoot ? undefined : 'parent-id',
    isEvent: false,
  } as AnyExportedSpan;

  return mockSpan;
}
