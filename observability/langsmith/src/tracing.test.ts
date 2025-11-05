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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LangSmithExporter } from './tracing';
import type { LangSmithExporterConfig } from './tracing';

// Mock LangSmith (must be at the top level)
vi.mock('langsmith');

describe('LangSmithExporter', () => {
  // Mock objects
  let mockRunTree: any;
  let mockClient: any;
  let MockRunTreeClass: any;
  let MockClientClass: any;

  let exporter: LangSmithExporter;
  let config: LangSmithExporterConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up mocks for RunTree
    mockRunTree = {
      createChild: vi.fn(),
      postRun: vi.fn().mockResolvedValue(undefined),
      patchRun: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
      inputs: {},
      outputs: {},
      metadata: {},
      error: undefined,
    };

    // Set up circular reference for child RunTrees
    mockRunTree.createChild.mockReturnValue(mockRunTree);

    // Mock RunTree constructor
    MockRunTreeClass = vi.mocked(RunTree);
    MockRunTreeClass.mockImplementation(() => mockRunTree);

    // Set up mock for Client
    mockClient = {
      createRun: vi.fn(),
      updateRun: vi.fn(),
    };

    MockClientClass = vi.mocked(Client);
    MockClientClass.mockImplementation(() => mockClient);

    config = {
      apiKey: 'test-api-key',
      apiUrl: 'https://test-langsmith.com',
      logLevel: 'debug' as const,
    };

    exporter = new LangSmithExporter(config);
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(exporter.name).toBe('langsmith');
    });

    it('should disable exporter when apiKey is missing', async () => {
      const invalidConfig = {
        // Missing apiKey
        apiUrl: 'https://test.com',
      };

      const disabledExporter = new LangSmithExporter(invalidConfig);

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
        name: 'root-agent',
        run_type: 'chain', // Default span type mapping for AGENT_RUN
        client: mockClient,
        metadata: {
          mastra_span_type: 'agent_run',
          agentId: 'agent-123',
          instructions: 'Test agent',
          userId: 'user-456',
          sessionId: 'session-789',
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
        name: 'child-tool',
        run_type: 'tool', // TOOL_CALL maps to 'tool'
        client: mockClient,
        metadata: {
          mastra_span_type: 'tool_call',
          toolId: 'calculator',
        },
      });

      // Should post the child run
      expect(mockRunTree.postRun).toHaveBeenCalledTimes(2);
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

      expect(MockRunTreeClass).toHaveBeenCalledWith(
        expect.objectContaining({
          run_type: 'llm',
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

      expect(MockRunTreeClass).toHaveBeenCalledWith({
        name: 'gpt-4-call',
        run_type: 'llm',
        client: mockClient,
        inputs: { messages: [{ role: 'user', content: 'Hello' }] },
        outputs: { content: 'Hi there!' },
        metadata: {
          mastra_span_type: 'model_generation',
          ls_model_name: 'gpt-4',
          ls_provider: 'openai',
          provider: 'openai',
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
        name: 'simple-llm',
        run_type: 'llm',
        client: mockClient,
        metadata: {
          mastra_span_type: 'model_generation',
          ls_model_name: 'gpt-3.5-turbo',
          usage_metadata: {},
        },
      });
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
        usage: { totalTokens: 150 },
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
            total_tokens: 150,
          },
        }),
      );
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
      expect(mockRunTree.end).toHaveBeenCalledWith({ endTime: span.endTime.getTime() / 1000 });
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

      expect(mockRunTree.end).toHaveBeenCalledWith({ endTime: errorSpan.endTime.getTime() / 1000 });
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
      expect((exporter as any).traceMap.has('root-span')).toBe(true);

      rootSpan.endTime = new Date();

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: rootSpan,
      });

      // Should clean up traceMap
      expect((exporter as any).traceMap.has('root-span')).toBe(false);
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
        name: 'user-feedback',
        type: 'chain',
        client: mockClient,
        startTime: eventSpan.startTime.getTime() / 1000,
        outputs: { message: 'Great response!' },
        metadata: {
          mastra_span_type: 'generic',
          eventType: 'user_feedback',
          rating: 5,
        },
      });

      // Should post the run
      expect(mockRunTree.postRun).toHaveBeenCalled();

      // Should immediately end with same timestamp
      expect(mockRunTree.end).toHaveBeenCalledWith({ endTime: eventSpan.startTime.getTime() / 1000 });
      expect(mockRunTree.patchRun).toHaveBeenCalled();
    });

    it('should create zero-duration child RunTrees for child event spans', async () => {
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
      childEventSpan.traceId = 'root-span';
      childEventSpan.parentSpanId = 'root-span';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: childEventSpan,
      });

      // Should create child RunTree on parent
      expect(mockRunTree.createChild).toHaveBeenCalledWith({
        name: 'tool-result',
        type: 'chain',
        client: mockClient,
        startTime: childEventSpan.startTime.getTime() / 1000,
        outputs: { result: 42 },
        metadata: {
          mastra_span_type: 'generic',
          toolName: 'calculator',
          success: true,
        },
      });

      // Should post and immediately end the child
      expect(mockRunTree.postRun).toHaveBeenCalledTimes(2);
      expect(mockRunTree.end).toHaveBeenCalledWith({ endTime: childEventSpan.startTime.getTime() / 1000 });
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
      expect((exporter as any).traceMap.size).toBeGreaterThan(0);

      // Shutdown
      await exporter.shutdown();

      // Verify all RunTrees were ended and patched
      expect(mockRunTree.end).toHaveBeenCalled();
      expect(mockRunTree.patchRun).toHaveBeenCalled();

      // Verify maps were cleared
      expect((exporter as any).traceMap.size).toBe(0);
    });

    it('should handle shutdown when exporter is disabled', async () => {
      const disabledExporter = new LangSmithExporter({});

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
    traceId: isRoot ? id : 'parent-trace-id',
    get isRootSpan() {
      return isRoot;
    },
    parentSpanId: isRoot ? undefined : 'parent-id',
    isEvent: false,
  } as AnyExportedSpan;

  return mockSpan;
}
