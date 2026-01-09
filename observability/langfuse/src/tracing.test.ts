/**
 * Langfuse Exporter Tests
 *
 * These tests focus on Langfuse-specific functionality:
 * - Langfuse client interactions
 * - Mapping logic (spans -> traces/generations/spans)
 * - Type-specific metadata extraction
 * - Langfuse-specific error handling
 */

import type {
  TracingEvent,
  AnyExportedSpan,
  ModelGenerationAttributes,
  ToolCallAttributes,
} from '@mastra/core/observability';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { Langfuse } from 'langfuse';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LangfuseExporter } from './tracing';
import type { LangfuseExporterConfig } from './tracing';

// Mock Langfuse constructor (must be at the top level)
vi.mock('langfuse');

class TestLangfuseExporter extends LangfuseExporter {
  _getTraceData(traceId: string) {
    return this.getTraceData({ traceId, method: 'test' });
  }

  get _traceMapSize(): number {
    return this.traceMapSize();
  }
}

describe('LangfuseExporter', () => {
  // Mock objects
  let mockGeneration: any;
  let mockSpan: any;
  let mockTrace: any;
  let mockLangfuseClient: any;
  let LangfuseMock: any;

  let exporter: TestLangfuseExporter;
  let config: LangfuseExporterConfig;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Set up mocks
    mockGeneration = {
      kind: 'mockGeneration',
      event: vi.fn(),
      generation: vi.fn(),
      span: vi.fn(),
      update: vi.fn(),
      end: vi.fn(),
    };

    // Set up circular reference
    mockGeneration.generation.mockReturnValue(mockGeneration);

    mockSpan = {
      kind: 'mockSpan',
      update: vi.fn(),
      end: vi.fn(),
      generation: vi.fn().mockReturnValue(mockGeneration),
      span: vi.fn(),
      event: vi.fn(),
    };

    // Set up circular reference
    mockSpan.span.mockReturnValue(mockSpan);
    mockGeneration.span.mockReturnValue(mockSpan);

    mockTrace = {
      kind: 'mockTrace',
      generation: vi.fn().mockReturnValue(mockGeneration),
      span: vi.fn().mockReturnValue(mockSpan),
      update: vi.fn(),
      end: vi.fn(),
      event: vi.fn(),
    };

    mockLangfuseClient = {
      kind: 'mockLangfuseClient',
      trace: vi.fn().mockReturnValue(mockTrace),
      shutdownAsync: vi.fn().mockResolvedValue(undefined),
      flushAsync: vi.fn().mockResolvedValue(undefined),
      score: vi.fn(),
    };

    // Get the mocked Langfuse constructor and configure it
    LangfuseMock = vi.mocked(Langfuse);
    LangfuseMock.mockImplementation(function () {
      return mockLangfuseClient;
    });

    config = {
      publicKey: 'test-public-key',
      secretKey: 'test-secret-key',
      baseUrl: 'https://test-langfuse.com',
      options: {
        debug: false,
        flushAt: 1,
        flushInterval: 1000,
      },
      logLevel: 'debug',
      // Short cleanup delay for faster tests
      traceCleanupDelayMs: 10,
    };

    exporter = new TestLangfuseExporter(config);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(exporter.name).toBe('langfuse');
      // Verify Langfuse client was created with correct config
      expect(LangfuseMock).toHaveBeenCalledWith({
        publicKey: 'test-public-key',
        secretKey: 'test-secret-key',
        baseUrl: 'https://test-langfuse.com',
        debug: false,
        flushAt: 1,
        flushInterval: 1000,
      });
    });

    it('should initialize without baseUrl (uses Langfuse default)', () => {
      // Clear env var to ensure baseUrl comes from config only
      const originalBaseUrl = process.env.LANGFUSE_BASE_URL;
      delete process.env.LANGFUSE_BASE_URL;

      try {
        const configWithoutBaseUrl = {
          publicKey: 'test-public-key',
          secretKey: 'test-secret-key',
        };

        const exporterWithoutBaseUrl = new LangfuseExporter(configWithoutBaseUrl);

        expect(exporterWithoutBaseUrl.name).toBe('langfuse');
        expect(LangfuseMock).toHaveBeenCalledWith({
          publicKey: 'test-public-key',
          secretKey: 'test-secret-key',
          baseUrl: undefined,
        });
      } finally {
        if (originalBaseUrl !== undefined) process.env.LANGFUSE_BASE_URL = originalBaseUrl;
      }
    });

    it('should warn and disable exporter when publicKey is missing', () => {
      // Clear env vars to ensure exporter is truly disabled
      const originalPublicKey = process.env.LANGFUSE_PUBLIC_KEY;
      delete process.env.LANGFUSE_PUBLIC_KEY;
      const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        const exporterWithMissingKey = new LangfuseExporter({
          secretKey: 'test-secret-key',
          baseUrl: 'https://test-langfuse.com',
        });

        // Should create exporter but disable it
        expect(exporterWithMissingKey.name).toBe('langfuse');
        expect(exporterWithMissingKey.isDisabled).toBeTruthy();
      } finally {
        mockConsoleWarn.mockRestore();
        if (originalPublicKey !== undefined) process.env.LANGFUSE_PUBLIC_KEY = originalPublicKey;
      }
    });

    it('should warn and disable exporter when secretKey is missing', () => {
      // Clear env vars to ensure exporter is truly disabled
      const originalSecretKey = process.env.LANGFUSE_SECRET_KEY;
      delete process.env.LANGFUSE_SECRET_KEY;
      const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        const exporterWithMissingKey = new LangfuseExporter({
          publicKey: 'test-public-key',
          baseUrl: 'https://test-langfuse.com',
        });

        // Should create exporter but disable it
        expect(exporterWithMissingKey.name).toBe('langfuse');
        expect(exporterWithMissingKey.isDisabled).toBeTruthy();
      } finally {
        mockConsoleWarn.mockRestore();
        if (originalSecretKey !== undefined) process.env.LANGFUSE_SECRET_KEY = originalSecretKey;
      }
    });

    it('should warn and disable exporter when both keys are missing', () => {
      // Clear env vars to ensure exporter is truly disabled
      const originalPublicKey = process.env.LANGFUSE_PUBLIC_KEY;
      const originalSecretKey = process.env.LANGFUSE_SECRET_KEY;
      delete process.env.LANGFUSE_PUBLIC_KEY;
      delete process.env.LANGFUSE_SECRET_KEY;
      const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        const exporterWithMissingKeys = new LangfuseExporter({
          baseUrl: 'https://test-langfuse.com',
        });

        // Should create exporter but disable it
        expect(exporterWithMissingKeys.name).toBe('langfuse');
        expect(exporterWithMissingKeys.isDisabled).toBeTruthy();
      } finally {
        mockConsoleWarn.mockRestore();
        if (originalPublicKey !== undefined) process.env.LANGFUSE_PUBLIC_KEY = originalPublicKey;
        if (originalSecretKey !== undefined) process.env.LANGFUSE_SECRET_KEY = originalSecretKey;
      }
    });
  });

  describe('Trace Creation', () => {
    it('should create Langfuse trace for root spans', async () => {
      const rootSpan = createMockSpan({
        id: 'root-span-id',
        name: 'root-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {
          agentId: 'agent-123',
          instructions: 'Test agent',
          spanType: 'agent_run',
        },
        metadata: { userId: 'user-456', sessionId: 'session-789' },
      });

      const event: TracingEvent = {
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      };

      await exporter.exportTracingEvent(event);

      // Should create Langfuse trace with correct parameters
      expect(mockLangfuseClient.trace).toHaveBeenCalledWith({
        id: 'root-span-id', // Uses span.trace.id
        name: 'root-agent',
        userId: 'user-456',
        sessionId: 'session-789',
        metadata: {
          agentId: 'agent-123',
          instructions: 'Test agent',
          spanType: 'agent_run',
        },
      });
    });

    it('should not create trace for child spans', async () => {
      const childSpan = createMockSpan({
        id: 'child-span-id',
        name: 'child-tool',
        type: SpanType.TOOL_CALL,
        isRoot: false,
        attributes: { toolId: 'calculator' },
      });

      const event: TracingEvent = {
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: childSpan,
      };

      await exporter.exportTracingEvent(event);

      // Should not create trace for child spans
      expect(mockLangfuseClient.trace).not.toHaveBeenCalled();
    });

    it('should reuse existing trace when multiple root spans share the same traceId', async () => {
      const sharedTraceId = 'shared-trace-123';

      // First root span (e.g., first agent.stream call)
      const firstRootSpan = createMockSpan({
        id: 'root-span-1',
        name: 'agent-call-1',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        traceId: sharedTraceId,
        attributes: {
          agentId: 'agent-123',
          instructions: 'Test agent',
          spanType: 'agent_run',
        },
        metadata: { userId: 'user-456', sessionId: 'session-789' },
      });

      // Child span of first root (e.g., tool call from first agent call)
      const firstChildSpan = createMockSpan({
        id: 'child-span-1',
        name: 'tool-call-1',
        type: SpanType.TOOL_CALL,
        isRoot: false,
        traceId: sharedTraceId,
        parentSpanId: 'root-span-1',
        attributes: { toolId: 'calculator' },
      });

      // Second root span with same traceId (e.g., second agent.stream call after client-side tool)
      const secondRootSpan = createMockSpan({
        id: 'root-span-2',
        name: 'agent-call-2',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        traceId: sharedTraceId,
        attributes: {
          agentId: 'agent-123',
          instructions: 'Test agent',
          spanType: 'agent_run',
        },
        metadata: { userId: 'user-456', sessionId: 'session-789' },
      });

      // Child span of second root (e.g., tool call from second agent call)
      const secondChildSpan = createMockSpan({
        id: 'child-span-2',
        name: 'tool-call-2',
        type: SpanType.TOOL_CALL,
        isRoot: false,
        traceId: sharedTraceId,
        parentSpanId: 'root-span-2',
        attributes: { toolId: 'search' },
      });

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

      // Should create trace only once (for the shared traceId)
      expect(mockLangfuseClient.trace).toHaveBeenCalledTimes(1);
      expect(mockLangfuseClient.trace).toHaveBeenCalledWith({
        id: sharedTraceId,
        name: 'agent-call-1',
        userId: 'user-456',
        sessionId: 'session-789',
        metadata: {
          agentId: 'agent-123',
          instructions: 'Test agent',
          spanType: 'agent_run',
        },
      });

      // Both root spans and their children should be added to the same trace
      // First root span creates a span under the trace
      expect(mockTrace.span).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'root-span-1',
          name: 'agent-call-1',
        }),
      );

      // Second root span should also create a span under the same trace (not a new trace)
      expect(mockTrace.span).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'root-span-2',
          name: 'agent-call-2',
        }),
      );

      // Child spans should be created
      expect(mockSpan.span).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'child-span-1',
        }),
      );

      expect(mockSpan.span).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'child-span-2',
        }),
      );
    });

    it('should handle trace that exists in Langfuse but not in local traceMap (e.g., after server restart)', async () => {
      // Scenario: Server restarts, traceMap is cleared, but traces exist in Langfuse
      // When new spans arrive with the same traceId, we should create a new local reference
      // The Langfuse SDK handles this gracefully - it's idempotent and will update the existing trace

      const traceId = 'persisted-trace-id';

      // Simulate a span arriving after server restart
      const rootSpan = createMockSpan({
        id: 'new-root-span',
        name: 'agent-call-after-restart',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        traceId: traceId,
        attributes: {
          agentId: 'agent-123',
          instructions: 'Test agent',
          spanType: 'agent_run',
        },
        metadata: { userId: 'user-456', sessionId: 'session-789' },
      });

      // Process the span
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      });

      // Should call client.trace() to create/update the trace in Langfuse
      // The Langfuse SDK is idempotent - if the trace exists, it will update it
      expect(mockLangfuseClient.trace).toHaveBeenCalledWith({
        id: traceId,
        name: 'agent-call-after-restart',
        userId: 'user-456',
        sessionId: 'session-789',
        metadata: {
          agentId: 'agent-123',
          instructions: 'Test agent',
          spanType: 'agent_run',
        },
      });

      // The root span itself also creates a span under the trace
      expect(mockTrace.span).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'new-root-span',
          name: 'agent-call-after-restart',
        }),
      );

      // Add a child span to verify the trace is now in our local map
      const childSpan = createMockSpan({
        id: 'child-span',
        name: 'tool-call',
        type: SpanType.TOOL_CALL,
        isRoot: false,
        traceId: traceId,
        parentSpanId: 'new-root-span',
        attributes: { toolId: 'calculator' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: childSpan,
      });

      // Child span should be created under the root span
      expect(mockSpan.span).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'child-span',
          name: 'tool-call',
        }),
      );
    });
  });

  describe('LLM Generation Mapping', () => {
    it('should create Langfuse generation for MODEL_GENERATION spans', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-span-id',
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
            topP: 0.9,
          },
          streaming: false,
          resultType: 'response_generation',
        },
      });

      const event: TracingEvent = {
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      };

      await exporter.exportTracingEvent(event);

      // Should create Langfuse generation with LLM-specific fields
      // Note: usage is normalized from v4 format to unified format
      expect(mockTrace.generation).toHaveBeenCalledWith({
        id: 'llm-span-id',
        name: 'gpt-4-call',
        startTime: llmSpan.startTime,
        model: 'gpt-4',
        modelParameters: {
          temperature: 0.7,
          maxTokens: 100,
          topP: 0.9,
        },
        input: { messages: [{ role: 'user', content: 'Hello' }] },
        output: { content: 'Hi there!' },
        usageDetails: {
          input: 10,
          output: 5,
          total: 15,
        },
        metadata: expect.objectContaining({
          provider: 'openai',
          resultType: 'response_generation',
          spanType: 'model_generation',
          streaming: false,
        }),
      });
    });

    it('should handle LLM spans without optional fields', async () => {
      const minimalLlmSpan = createMockSpan({
        id: 'minimal-llm',
        name: 'simple-llm',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: {
          model: 'gpt-3.5-turbo',
          // No usage, parameters, input, output, etc.
        },
      });

      const event: TracingEvent = {
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: minimalLlmSpan,
      };

      await exporter.exportTracingEvent(event);

      expect(mockTrace.generation).toHaveBeenCalledWith({
        id: 'minimal-llm',
        name: 'simple-llm',
        startTime: minimalLlmSpan.startTime,
        model: 'gpt-3.5-turbo',
        metadata: {
          spanType: 'model_generation',
        },
      });
    });
  });

  describe('Regular Span Mapping', () => {
    it('should create Langfuse span for non-LLM span types', async () => {
      const toolSpan = createMockSpan({
        id: 'tool-span-id',
        name: 'calculator-tool',
        type: SpanType.TOOL_CALL,
        isRoot: true,
        input: { operation: 'add', a: 2, b: 3 },
        output: { result: 5 },
        attributes: {
          toolId: 'calculator',
          success: true,
        },
      });

      const event: TracingEvent = {
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: toolSpan,
      };

      await exporter.exportTracingEvent(event);

      expect(mockTrace.span).toHaveBeenCalledWith({
        id: 'tool-span-id',
        name: 'calculator-tool',
        startTime: toolSpan.startTime,
        input: { operation: 'add', a: 2, b: 3 },
        output: { result: 5 },
        metadata: {
          spanType: 'tool_call',
          toolId: 'calculator',
          success: true,
        },
      });
    });
  });

  describe('Type-Specific Metadata Extraction', () => {
    it('should extract agent-specific metadata', async () => {
      const agentSpan = createMockSpan({
        id: 'agent-span',
        name: 'customer-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {
          agentId: 'agent-456',
          availableTools: ['search', 'calculator'],
          maxSteps: 10,
          currentStep: 3,
          instructions: 'Help customers',
        },
      });

      const event: TracingEvent = {
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: agentSpan,
      };

      await exporter.exportTracingEvent(event);

      expect(mockTrace.span).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            spanType: 'agent_run',
            agentId: 'agent-456',
            availableTools: ['search', 'calculator'],
            maxSteps: 10,
            currentStep: 3,
          }),
        }),
      );
    });

    it('should extract MCP tool-specific metadata', async () => {
      const mcpSpan = createMockSpan({
        id: 'mcp-span',
        name: 'mcp-tool-call',
        type: SpanType.MCP_TOOL_CALL,
        isRoot: true,
        attributes: {
          toolId: 'file-reader',
          mcpServer: 'filesystem-mcp',
          serverVersion: '1.0.0',
          success: true,
        },
      });

      const event: TracingEvent = {
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: mcpSpan,
      };

      await exporter.exportTracingEvent(event);

      expect(mockTrace.span).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            spanType: 'mcp_tool_call',
            toolId: 'file-reader',
            mcpServer: 'filesystem-mcp',
            serverVersion: '1.0.0',
            success: true,
          }),
        }),
      );
    });

    it('should extract workflow-specific metadata', async () => {
      const workflowSpan = createMockSpan({
        id: 'workflow-span',
        name: 'data-processing-workflow',
        type: SpanType.WORKFLOW_RUN,
        isRoot: true,
        attributes: {
          workflowId: 'wf-123',
          status: 'running',
        },
      });

      const event: TracingEvent = {
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: workflowSpan,
      };

      await exporter.exportTracingEvent(event);

      expect(mockTrace.span).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            spanType: 'workflow_run',
            workflowId: 'wf-123',
            status: 'running',
          }),
        }),
      );
    });
  });

  describe('Span Updates', () => {
    it('should update LLM generation with new data', async () => {
      // First, start a span
      const llmSpan = createMockSpan({
        id: 'llm-span',
        traceId: 'llm-trace',
        name: 'gpt-4-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: { model: 'gpt-4' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      // Then update it
      llmSpan.attributes = {
        ...llmSpan.attributes,
        usage: { inputTokens: 100, outputTokens: 50 },
      } as ModelGenerationAttributes;
      llmSpan.output = { content: 'Updated response' };

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: llmSpan,
      });

      expect(mockGeneration.update).toHaveBeenCalledWith({
        metadata: expect.objectContaining({
          spanType: 'model_generation',
        }),
        model: 'gpt-4',
        output: { content: 'Updated response' },
        usageDetails: {
          input: 100,
          output: 50,
          total: 150,
        },
      });
    });

    it('should update regular spans', async () => {
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

      // Update with success
      toolSpan.attributes = {
        ...toolSpan.attributes,
        success: true,
      } as ToolCallAttributes;
      toolSpan.output = { result: 42 };

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: toolSpan,
      });

      expect(mockSpan.update).toHaveBeenCalledWith({
        metadata: expect.objectContaining({
          spanType: 'tool_call',
          success: true,
        }),
        output: { result: 42 },
      });
    });

    it('should include input in update payload (MODEL_STEP pattern)', async () => {
      // This test verifies the common pattern where MODEL_STEP spans:
      // 1. Start empty (to capture start time early)
      // 2. Get updated with input data later
      // 3. End with the final data

      // First create a root span (parent for the MODEL_STEP)
      const rootSpan = createMockSpan({
        id: 'root-span',
        name: 'agent-run',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      });

      // Create MODEL_STEP span with no input (empty start to capture timing)
      const modelStepSpan = createMockSpan({
        id: 'model-step-span',
        name: 'model-step',
        type: SpanType.MODEL_STEP,
        isRoot: false,
        parentSpanId: 'root-span',
        traceId: 'root-span',
        attributes: {},
        // Note: no input here - span starts empty
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: modelStepSpan,
      });

      // Verify span was created without input
      expect(mockSpan.span).toHaveBeenCalledTimes(1);
      expect(mockSpan.span).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'model-step-span',
          name: 'model-step',
        }),
      );
      // Verify the specific call didn't include input
      const createCallArg = mockSpan.span.mock.calls[0][0];
      expect(createCallArg).not.toHaveProperty('input');

      // Clear mock to track update calls
      mockSpan.update.mockClear();
      // Get the nested span mock (what mockSpan.span returns)
      const nestedSpan = mockSpan.span.mock.results[0]?.value;

      // Update the span with input data (this is what happens in practice)
      modelStepSpan.input = {
        messages: [{ role: 'user', content: 'Hello, world!' }],
      };

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: modelStepSpan,
      });

      // Verify update was called with the input
      expect(nestedSpan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            messages: [{ role: 'user', content: 'Hello, world!' }],
          },
        }),
      );
    });
  });

  describe('Span Ending', () => {
    it('should update span with endTime on span end', async () => {
      const exportedSpan = createMockSpan({
        id: 'test-span',
        name: 'test',
        type: SpanType.GENERIC,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan,
      });

      exportedSpan.endTime = new Date();

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan,
      });

      expect(mockSpan.update).toHaveBeenCalledWith({
        endTime: exportedSpan.endTime,
        metadata: expect.objectContaining({
          spanType: 'generic',
        }),
      });
    });

    it('should update span with error information on span end', async () => {
      const errorSpan = createMockSpan({
        id: 'error-span',
        name: 'failing-operation',
        type: SpanType.TOOL_CALL,
        isRoot: true,
        attributes: {
          toolId: 'failing-tool',
        },
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

      expect(mockSpan.update).toHaveBeenCalledWith({
        endTime: errorSpan.endTime,
        metadata: expect.objectContaining({
          spanType: 'tool_call',
          toolId: 'failing-tool',
        }),
        level: 'ERROR',
        statusMessage: 'Tool execution failed',
      });
    });

    it('should update root trace and clean up when root span ends (if no other active spans)', async () => {
      const rootSpan = createMockSpan({
        id: 'root-span-id',
        name: 'root-span',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
        traceId: 'trace-id',
      });

      rootSpan.output = { result: 'success' };
      rootSpan.endTime = new Date();

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      });

      const traceData = exporter._getTraceData(rootSpan.traceId);

      // Verify trace was created and span is tracked as active
      expect(traceData.isActiveSpan({ spanId: rootSpan.id })).toBe(true);

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: rootSpan,
      });

      // Should update trace with output
      expect(mockTrace.update).toHaveBeenCalledWith({
        output: { result: 'success' },
      });

      // Wait for cleanup delay (config uses 10ms)
      await vi.advanceTimersByTimeAsync(20);

      // Trace should be cleaned up since this was the only active span
      // (traceData is always created if it doesn't exist, but the old object
      // should have been cleaned up.)
      const newTraceData = exporter._getTraceData(rootSpan.traceId);
      expect(traceData).not.toBe(newTraceData);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing traces gracefully', async () => {
      const orphanSpan = createMockSpan({
        id: 'orphan-span',
        name: 'orphan',
        type: SpanType.TOOL_CALL,
        isRoot: false, // Child span without parent trace
        attributes: { toolId: 'orphan-tool' },
      });

      // Should not throw when trying to create child span without trace
      await expect(
        exporter.exportTracingEvent({
          type: TracingEventType.SPAN_STARTED,
          exportedSpan: orphanSpan,
        }),
      ).resolves.not.toThrow();

      // Should not create Langfuse span
      expect(mockTrace.span).not.toHaveBeenCalled();
      expect(mockTrace.generation).not.toHaveBeenCalled();
    });

    it('should handle missing Langfuse objects gracefully', async () => {
      const exportedSpan = createMockSpan({
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
          exportedSpan,
        }),
      ).resolves.not.toThrow();

      // Try to end non-existent span
      await expect(
        exporter.exportTracingEvent({
          type: TracingEventType.SPAN_ENDED,
          exportedSpan,
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('Event Span Handling', () => {
    let mockEvent: any;

    beforeEach(() => {
      mockEvent = {
        update: vi.fn(),
      };
      mockTrace.event.mockReturnValue(mockEvent);
      mockSpan.event.mockReturnValue(mockEvent);
      mockGeneration.event.mockReturnValue(mockEvent);
    });

    it('should create Langfuse event for root event spans', async () => {
      const eventSpan = createMockSpan({
        id: 'event-span-id',
        name: 'user-feedback',
        type: SpanType.GENERIC,
        isRoot: true,
        attributes: {
          eventType: 'user_feedback',
          rating: 5,
        },
        input: { message: 'Great response!' },
      });
      eventSpan.isEvent = true;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: eventSpan,
      });

      // Should create trace for root event span
      expect(mockLangfuseClient.trace).toHaveBeenCalledWith({
        id: 'event-span-id',
        name: 'user-feedback',
        input: { message: 'Great response!' },
        metadata: {
          spanType: 'generic',
          eventType: 'user_feedback',
          rating: 5,
        },
      });

      // Should create Langfuse event
      expect(mockTrace.event).toHaveBeenCalledWith({
        id: 'event-span-id',
        name: 'user-feedback',
        startTime: eventSpan.startTime,
        input: { message: 'Great response!' },
        metadata: {
          spanType: 'generic',
          eventType: 'user_feedback',
          rating: 5,
        },
      });
    });

    it('should create Langfuse event for child event spans', async () => {
      // First create a root span
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

      // Then create a child event span
      const childEventSpan = createMockSpan({
        id: 'child-event-id',
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
      childEventSpan.traceId = 'root-span-id';
      childEventSpan.parentSpanId = 'root-span-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: childEventSpan,
      });

      // Should create event under the parent span
      expect(mockSpan.event).toHaveBeenCalledWith({
        id: 'child-event-id',
        name: 'tool-result',
        startTime: childEventSpan.startTime,
        output: { result: 42 },
        metadata: {
          spanType: 'generic',
          toolName: 'calculator',
          success: true,
        },
      });
    });

    it('should handle event spans with missing parent gracefully', async () => {
      const orphanEventSpan = createMockSpan({
        id: 'orphan-event-id',
        name: 'orphan-event',
        type: SpanType.GENERIC,
        isRoot: false,
        attributes: {},
      });
      orphanEventSpan.isEvent = true;
      orphanEventSpan.traceId = 'missing-trace-id';

      // Should not throw
      await expect(
        exporter.exportTracingEvent({
          type: TracingEventType.SPAN_STARTED,
          exportedSpan: orphanEventSpan,
        }),
      ).resolves.not.toThrow();

      // Should not create any Langfuse objects
      expect(mockTrace.event).not.toHaveBeenCalled();
      expect(mockSpan.event).not.toHaveBeenCalled();
    });
  });

  describe('Out-of-order span handling with delayed ends', () => {
    it('should handle spans that end after parent trace is removed', async () => {
      const traceId = 'out-of-order-trace';

      // Create a root workflow span
      const workflowSpan = createMockSpan({
        id: 'workflow-1',
        name: 'test-workflow',
        type: SpanType.WORKFLOW_RUN,
        isRoot: true,
        attributes: { workflowId: 'wf-123' },
        traceId,
      });

      // Create a child step span
      const step1Span = createMockSpan({
        id: 'step-1',
        name: 'step-one',
        type: SpanType.WORKFLOW_STEP,
        isRoot: false,
        attributes: { stepId: 'step-1' },
        traceId,
        parentSpanId: workflowSpan.id,
      });

      // Start workflow and step
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: workflowSpan,
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: step1Span,
      });

      // Verify spans are tracked
      const traceData = exporter._getTraceData(traceId);
      expect(traceData.hasSpan({ spanId: 'step-1' })).toBe(true);

      // Clear mock calls to make assertions clearer
      mockTrace.span.mockClear();
      mockSpan.update.mockClear();
      mockTrace.update.mockClear();

      // Update step 1
      step1Span.output = { result: 'step1-complete' };
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: step1Span,
      });

      expect(mockSpan.update).toHaveBeenCalledWith({
        output: { result: 'step1-complete' },
        metadata: expect.objectContaining({
          spanType: 'workflow_step',
          stepId: 'step-1',
        }),
      });

      // End step 1
      step1Span.endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: step1Span,
      });

      expect(mockSpan.update).toHaveBeenCalledWith({
        endTime: step1Span.endTime,
        output: { result: 'step1-complete' }, // Output is still included from previous update
        metadata: expect.objectContaining({
          spanType: 'workflow_step',
          stepId: 'step-1',
        }),
      });

      // Start step 2 (but don't end it yet - this is the key to testing out-of-order)
      const step2Span = createMockSpan({
        id: 'step-2',
        name: 'step-two',
        type: SpanType.WORKFLOW_STEP,
        isRoot: false,
        attributes: { stepId: 'step-2' },
        traceId,
        parentSpanId: workflowSpan.id,
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: step2Span,
      });

      // Update workflow
      workflowSpan.output = { status: 'completed' };
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: workflowSpan,
      });

      // End workflow (root span) BEFORE step-2 ends - this is the out-of-order scenario
      workflowSpan.endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: workflowSpan,
      });

      // step-2 should still be in activeSpans
      expect(traceData.isActiveSpan({ spanId: 'step-2' })).toBe(true);
      expect(traceData.isActiveSpan({ spanId: 'step-1' })).toBe(false); // step-1 already ended
      expect(traceData.isActiveSpan({ spanId: 'workflow-1' })).toBe(false); // workflow ended

      // Now end step-2 (the last active span) AFTER the root ended
      step2Span.endTime = new Date();
      step2Span.output = { result: 'step2-complete' };
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: step2Span,
      });

      // Clear mocks for late event testing
      mockSpan.update.mockClear();
      mockTrace.update.mockClear();

      // Wait for cleanup delay (config uses 10ms)
      await vi.advanceTimersByTimeAsync(20);

      // Now try to send late updates/ends for already completed trace
      const lateStep1Update = createMockSpan({
        id: 'step-1',
        name: 'step-one',
        type: SpanType.WORKFLOW_STEP,
        isRoot: false,
        attributes: { stepId: 'step-1', lateUpdate: true },
        traceId,
        parentSpanId: workflowSpan.id,
        output: { result: 'late-update' },
      });

      // This should handle gracefully without errors
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: lateStep1Update,
      });

      // Should not attempt to update since trace is gone
      expect(mockSpan.update).not.toHaveBeenCalled();
    });

    it('should handle multiple rapid updates and ends in sequence', async () => {
      // Simulate rapid-fire events that might arrive out of order
      const rootSpan = createMockSpan({
        id: 'root-1',
        name: 'rapid-root',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: { agentId: 'rapid-agent' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      });

      // get a pointer to the initial traceData for trace
      const traceData = exporter._getTraceData('root-1');

      // Create multiple child spans
      const childSpans: AnyExportedSpan[] = [];
      for (let i = 1; i <= 5; i++) {
        const child = createMockSpan({
          id: `child-${i}`,
          name: `rapid-child-${i}`,
          type: SpanType.TOOL_CALL,
          isRoot: false,
          attributes: { toolId: `tool-${i}` },
        });
        child.traceId = 'root-1';
        child.parentSpanId = 'root-1';
        childSpans.push(child);
      }

      // Start all children rapidly
      for (const child of childSpans) {
        await exporter.exportTracingEvent({
          type: TracingEventType.SPAN_STARTED,
          exportedSpan: child,
        });
      }

      // Update and end children in mixed order
      // End child 3
      childSpans[2].endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: childSpans[2],
      });

      // Update child 1
      childSpans[0].output = { result: 'child-1-result' };
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: childSpans[0],
      });

      // End child 5
      childSpans[4].endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: childSpans[4],
      });

      // Update child 3 (after it ended)
      childSpans[2].output = { result: 'late-update-3' };
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: childSpans[2],
      });

      // End remaining children
      for (const child of [childSpans[0], childSpans[1], childSpans[3]]) {
        child.endTime = new Date();
        await exporter.exportTracingEvent({
          type: TracingEventType.SPAN_ENDED,
          exportedSpan: child,
        });
      }

      // End root
      rootSpan.endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: rootSpan,
      });

      // Wait for cleanup delay (config uses 10ms)
      await vi.advanceTimersByTimeAsync(20);

      // All operations should complete without errors
      // Trace should be cleaned up since all spans have ended
      // (traceData is always created if it doesn't exist, but the old object
      // should have been cleaned up.)
      const newTraceData = exporter._getTraceData('root-1');
      expect(traceData).not.toBe(newTraceData);
    });
  });

  describe('Score Submission from span.scores', () => {
    beforeEach(() => {
      mockLangfuseClient.score = vi.fn();
    });

    it('should submit scores from span.scores on span update', async () => {
      const rootSpan = createMockSpan({
        id: 'root-span',
        traceId: 'trace-123',
        name: 'agent-run',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
      });

      // Create the trace first
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      });

      // Update span with scores attached
      const spanWithScores = {
        ...rootSpan,
        scores: [
          {
            scorerId: 'quality-scorer',
            scorerName: 'Quality Scorer',
            score: 0.95,
            reason: 'High quality response',
            timestamp: 1234567890,
            metadata: { analyzeStepResult: { quality: 'high' } },
          },
        ],
      };

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: spanWithScores,
      });

      expect(mockLangfuseClient.score).toHaveBeenCalledWith({
        id: 'trace-123-root-span-quality-scorer',
        traceId: 'trace-123',
        observationId: 'root-span',
        name: 'Quality Scorer',
        value: 0.95,
        comment: 'High quality response',
        dataType: 'NUMERIC',
        metadata: { analyzeStepResult: { quality: 'high' } },
      });
    });

    it('should submit multiple scores from span.scores', async () => {
      const rootSpan = createMockSpan({
        id: 'root-span',
        traceId: 'trace-123',
        name: 'agent-run',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      });

      const spanWithScores = {
        ...rootSpan,
        scores: [
          {
            scorerId: 'relevance-scorer',
            scorerName: 'Relevance',
            score: 0.9,
            reason: 'Relevant',
            timestamp: 1000,
            metadata: { key: 'value1' },
          },
          {
            scorerId: 'safety-scorer',
            scorerName: 'Safety',
            score: 1.0,
            timestamp: 2000,
          },
        ],
      };

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: spanWithScores,
      });

      expect(mockLangfuseClient.score).toHaveBeenCalledTimes(2);
      expect(mockLangfuseClient.score).toHaveBeenCalledWith({
        id: 'trace-123-root-span-relevance-scorer',
        traceId: 'trace-123',
        observationId: 'root-span',
        name: 'Relevance',
        value: 0.9,
        comment: 'Relevant',
        dataType: 'NUMERIC',
        metadata: { key: 'value1' },
      });
      expect(mockLangfuseClient.score).toHaveBeenCalledWith({
        id: 'trace-123-root-span-safety-scorer',
        traceId: 'trace-123',
        observationId: 'root-span',
        name: 'Safety',
        value: 1.0,
        comment: undefined,
        dataType: 'NUMERIC',
        metadata: undefined,
      });
    });

    it('should not submit scores when span has no scores', async () => {
      const rootSpan = createMockSpan({
        id: 'root-span',
        traceId: 'trace-123',
        name: 'agent-run',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: rootSpan,
      });

      expect(mockLangfuseClient.score).not.toHaveBeenCalled();
    });

    it('should not submit scores when client is disabled', async () => {
      const disabledExporter = new LangfuseExporter({
        baseUrl: 'https://test-langfuse.com',
      });

      const spanWithScores = createMockSpan({
        id: 'root-span',
        traceId: 'trace-123',
        name: 'agent-run',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
      });
      (spanWithScores as any).scores = [
        {
          scorerId: 'test-scorer',
          scorerName: 'Test',
          score: 0.8,
          timestamp: 1000,
        },
      ];

      // When client is disabled, nothing should happen
      await disabledExporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: spanWithScores,
      });

      expect(mockLangfuseClient.score).not.toHaveBeenCalled();
    });
  });

  describe('Token Usage Normalization', () => {
    it('should handle token format with inputTokens/outputTokens', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-v5-span',
        name: 'llm-generation-v5',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: {
          model: 'gpt-4o',
          provider: 'openai',
          usage: {
            inputTokens: 120,
            outputTokens: 60,
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockTrace.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          usageDetails: {
            input: 120,
            output: 60,
            total: 180,
          },
        }),
      );
    });

    it('should handle reasoning tokens from outputDetails', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-v5-reasoning-span',
        name: 'llm-generation-reasoning',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: {
          model: 'o1-preview',
          provider: 'openai',
          usage: {
            inputTokens: 100,
            outputTokens: 1050,
            outputDetails: { reasoning: 1000 },
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockTrace.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'o1-preview',
          usageDetails: {
            input: 100,
            output: 1050,
            reasoning: 1000,
            total: 1150,
          },
        }),
      );
    });

    it('should handle cached input tokens from inputDetails', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-v5-cached-span',
        name: 'llm-generation-cached',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: {
          model: 'claude-3-5-sonnet',
          provider: 'anthropic',
          usage: {
            inputTokens: 150,
            outputTokens: 75,
            inputDetails: { cacheRead: 100 },
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockTrace.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-5-sonnet',
          usageDetails: {
            input: 150,
            output: 75,
            cache_read_input_tokens: 100,
            total: 225,
          },
        }),
      );
    });

    it('should calculate total tokens when not provided', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-calculated-total',
        name: 'llm-generation-calc',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          usage: {
            inputTokens: 80,
            outputTokens: 40,
            // no totalTokens provided
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockTrace.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          usageDetails: {
            input: 80,
            output: 40,
            total: 120, // calculated
          },
        }),
      );
    });
  });

  describe('Langfuse Prompt Linking', () => {
    it('should link prompt to generation when metadata.langfuse.prompt is set', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-with-prompt',
        name: 'gpt-4-call-with-prompt',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        input: { messages: [{ role: 'user', content: 'Hello' }] },
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
        },
        metadata: {
          langfuse: {
            prompt: {
              name: 'greeting-prompt',
              version: 3,
            },
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockTrace.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'llm-with-prompt',
          name: 'gpt-4-call-with-prompt',
          model: 'gpt-4',
          prompt: {
            name: 'greeting-prompt',
            version: 3,
          },
        }),
      );
    });

    it('should link prompt with all fields when name, version, and id are set', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-with-prompt-id',
        name: 'gpt-4-call-with-prompt-id',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        input: { messages: [{ role: 'user', content: 'Hello' }] },
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
        },
        metadata: {
          langfuse: {
            prompt: {
              name: 'customer-support',
              version: 5,
              id: 'prompt-uuid-12345',
            },
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockTrace.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'llm-with-prompt-id',
          prompt: {
            name: 'customer-support',
            version: 5,
            id: 'prompt-uuid-12345',
          },
        }),
      );
    });

    it('should link prompt with id alone', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-with-id-only',
        name: 'gpt-4-call-id-only',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: {
          model: 'gpt-4',
        },
        metadata: {
          langfuse: {
            prompt: {
              id: 'prompt-uuid-only',
            },
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockTrace.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'llm-with-id-only',
          prompt: {
            id: 'prompt-uuid-only',
          },
        }),
      );
    });

    it('should not include prompt field for non-MODEL_GENERATION spans', async () => {
      const toolSpan = createMockSpan({
        id: 'tool-with-prompt-metadata',
        name: 'calculator-tool',
        type: SpanType.TOOL_CALL,
        isRoot: true,
        input: { operation: 'add', a: 2, b: 3 },
        attributes: {
          toolId: 'calculator',
        },
        metadata: {
          langfuse: {
            prompt: {
              name: 'some-prompt',
              version: 1,
            },
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: toolSpan,
      });

      // Should not include prompt in non-generation spans
      const call = mockTrace.span.mock.calls[0][0];
      expect(call.prompt).toBeUndefined();
    });

    it('should omit langfuse property from metadata after extracting prompt', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-clean-metadata',
        name: 'gpt-4-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: {
          model: 'gpt-4',
        },
        metadata: {
          langfuse: {
            prompt: {
              name: 'test-prompt',
              version: 1,
            },
          },
          customField: 'should-remain',
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      const call = mockTrace.generation.mock.calls[0][0];
      // Should have prompt at top level
      expect(call.prompt).toEqual({
        name: 'test-prompt',
        version: 1,
      });
      // Should not have langfuse in metadata (it's been extracted)
      expect(call.metadata.langfuse).toBeUndefined();
      // Should preserve other metadata
      expect(call.metadata.customField).toBe('should-remain');
    });

    it('should handle metadata.langfuse without prompt gracefully', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-no-prompt',
        name: 'gpt-4-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: {
          model: 'gpt-4',
        },
        metadata: {
          langfuse: {
            someOtherField: 'value',
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      const call = mockTrace.generation.mock.calls[0][0];
      // Should not have prompt
      expect(call.prompt).toBeUndefined();
      // Should preserve langfuse metadata if no prompt was extracted
      expect(call.metadata.langfuse).toEqual({ someOtherField: 'value' });
    });

    it('should inherit langfuse prompt from AGENT_RUN root span to child MODEL_GENERATION span', async () => {
      // First, create a root AGENT_RUN span with langfuse prompt metadata
      // (simulates: tracingOptions: buildTracingOptions(withLangfusePrompt(prompt)))
      const traceId = 'traceId';
      const agentSpan = createMockSpan({
        id: 'agent-span-id',
        name: 'support-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {
          agentId: 'support-agent',
          instructions: 'Help customers',
        },
        metadata: {
          langfuse: {
            prompt: {
              name: 'customer-support',
              version: 3,
              id: 'prompt-uuid-abc123',
            },
          },
        },
        traceId,
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: agentSpan,
      });

      // Create a child MODEL_GENERATION span WITHOUT langfuse metadata
      // (this is what happens in practice - model.ts doesn't pass langfuse metadata)
      const llmSpan = createMockSpan({
        id: 'llm-span-id',
        name: 'gpt-4-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: false,
        input: { messages: [{ role: 'user', content: 'Hello' }] },
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
        },
        metadata: {
          runId: 'run-123',
          threadId: 'thread-456',
        },
        traceId,
      });
      llmSpan.parentSpanId = 'agent-span-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      // The MODEL_GENERATION span should inherit the prompt from the AGENT_RUN root span
      expect(mockSpan.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'llm-span-id',
          name: 'gpt-4-call',
          model: 'gpt-4',
          prompt: {
            name: 'customer-support',
            version: 3,
            id: 'prompt-uuid-abc123',
          },
        }),
      );
    });

    it('should inherit langfuse prompt to MODEL_GENERATION even when root span has other metadata', async () => {
      // Root span with langfuse prompt and other metadata
      const agentSpan = createMockSpan({
        id: 'agent-span-id',
        name: 'support-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {
          agentId: 'support-agent',
        },
        metadata: {
          userId: 'user-123',
          sessionId: 'session-456',
          langfuse: {
            prompt: {
              name: 'greeting-prompt',
              version: 1,
            },
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: agentSpan,
      });

      // Child MODEL_GENERATION span without langfuse metadata
      const llmSpan = createMockSpan({
        id: 'llm-span-id',
        name: 'gpt-4-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: false,
        attributes: {
          model: 'gpt-4',
        },
        metadata: {
          runId: 'run-123',
        },
      });
      llmSpan.traceId = 'agent-span-id';
      llmSpan.parentSpanId = 'agent-span-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      // Should inherit prompt from root span
      expect(mockSpan.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: {
            name: 'greeting-prompt',
            version: 1,
          },
        }),
      );
    });

    it('should prefer span-level langfuse prompt over inherited root span prompt', async () => {
      // Root span with langfuse prompt
      const agentSpan = createMockSpan({
        id: 'agent-span-id',
        name: 'support-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
        metadata: {
          langfuse: {
            prompt: {
              name: 'root-prompt',
              version: 1,
            },
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: agentSpan,
      });

      // Child MODEL_GENERATION span WITH its own langfuse metadata
      const llmSpan = createMockSpan({
        id: 'llm-span-id',
        name: 'gpt-4-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: false,
        attributes: {
          model: 'gpt-4',
        },
        metadata: {
          langfuse: {
            prompt: {
              name: 'span-specific-prompt',
              version: 5,
            },
          },
        },
      });
      llmSpan.traceId = 'agent-span-id';
      llmSpan.parentSpanId = 'agent-span-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      // Should use the span's own prompt, not the inherited one
      expect(mockSpan.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: {
            name: 'span-specific-prompt',
            version: 5,
          },
        }),
      );
    });

    it('should not add prompt to MODEL_GENERATION when root span has no langfuse data', async () => {
      // Root span WITHOUT langfuse metadata
      const agentSpan = createMockSpan({
        id: 'agent-span-id',
        name: 'plain-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
        metadata: {
          userId: 'user-123',
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: agentSpan,
      });

      // Child MODEL_GENERATION span without langfuse metadata
      const llmSpan = createMockSpan({
        id: 'llm-span-id',
        name: 'gpt-4-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: false,
        attributes: {
          model: 'gpt-4',
        },
        metadata: {},
      });
      llmSpan.traceId = 'agent-span-id';
      llmSpan.parentSpanId = 'agent-span-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      // Should not have prompt field
      const call = mockSpan.generation.mock.calls[0][0];
      expect(call.prompt).toBeUndefined();
    });
  });

  describe('Multiple Langfuse Prompts in Single Trace', () => {
    it('should handle workflow calling multiple agents with different prompts', async () => {
      // Workflow root span (no langfuse prompt)
      const workflowSpan = createMockSpan({
        id: 'workflow-span-id',
        name: 'customer-journey-workflow',
        type: SpanType.WORKFLOW_RUN,
        isRoot: true,
        attributes: { workflowId: 'customer-journey' },
        metadata: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: workflowSpan,
      });

      // Agent 1 with its own prompt (greeting agent)
      const agent1Span = createMockSpan({
        id: 'agent-1-span-id',
        name: 'greeting-agent',
        type: SpanType.AGENT_RUN,
        isRoot: false,
        attributes: { agentId: 'greeting-agent' },
        metadata: {
          langfuse: {
            prompt: {
              name: 'greeting-prompt',
              version: 2,
            },
          },
        },
      });
      agent1Span.traceId = 'workflow-span-id';
      agent1Span.parentSpanId = 'workflow-span-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: agent1Span,
      });

      // Agent 1's MODEL_GENERATION (should inherit greeting-prompt)
      const llm1Span = createMockSpan({
        id: 'llm-1-span-id',
        name: 'gpt-4-greeting',
        type: SpanType.MODEL_GENERATION,
        isRoot: false,
        attributes: { model: 'gpt-4' },
        metadata: {},
      });
      llm1Span.traceId = 'workflow-span-id';
      llm1Span.parentSpanId = 'agent-1-span-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llm1Span,
      });

      // Verify first MODEL_GENERATION inherits greeting-prompt
      expect(mockSpan.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'llm-1-span-id',
          prompt: {
            name: 'greeting-prompt',
            version: 2,
          },
        }),
      );

      // Clear mock for next agent
      mockSpan.generation.mockClear();

      // Agent 2 with different prompt (support agent)
      const agent2Span = createMockSpan({
        id: 'agent-2-span-id',
        name: 'support-agent',
        type: SpanType.AGENT_RUN,
        isRoot: false,
        attributes: { agentId: 'support-agent' },
        metadata: {
          langfuse: {
            prompt: {
              name: 'customer-support-prompt',
              version: 5,
              id: 'support-prompt-uuid',
            },
          },
        },
      });
      agent2Span.traceId = 'workflow-span-id';
      agent2Span.parentSpanId = 'workflow-span-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: agent2Span,
      });

      // Agent 2's MODEL_GENERATION (should inherit customer-support-prompt)
      const llm2Span = createMockSpan({
        id: 'llm-2-span-id',
        name: 'gpt-4-support',
        type: SpanType.MODEL_GENERATION,
        isRoot: false,
        attributes: { model: 'gpt-4' },
        metadata: {},
      });
      llm2Span.traceId = 'workflow-span-id';
      llm2Span.parentSpanId = 'agent-2-span-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llm2Span,
      });

      // Verify second MODEL_GENERATION inherits customer-support-prompt
      expect(mockSpan.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'llm-2-span-id',
          prompt: {
            name: 'customer-support-prompt',
            version: 5,
            id: 'support-prompt-uuid',
          },
        }),
      );
    });

    it('should handle nested agents with different prompts', async () => {
      // Root agent with prompt A
      const rootAgentSpan = createMockSpan({
        id: 'root-agent-id',
        name: 'orchestrator-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: { agentId: 'orchestrator' },
        metadata: {
          langfuse: {
            prompt: {
              name: 'orchestrator-prompt',
              version: 1,
            },
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootAgentSpan,
      });

      // Root agent's MODEL_GENERATION (inherits orchestrator-prompt)
      const rootLlmSpan = createMockSpan({
        id: 'root-llm-id',
        name: 'gpt-4-orchestrate',
        type: SpanType.MODEL_GENERATION,
        isRoot: false,
        attributes: { model: 'gpt-4' },
        metadata: {},
      });
      rootLlmSpan.traceId = 'root-agent-id';
      rootLlmSpan.parentSpanId = 'root-agent-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootLlmSpan,
      });

      expect(mockSpan.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'root-llm-id',
          prompt: {
            name: 'orchestrator-prompt',
            version: 1,
          },
        }),
      );

      mockSpan.generation.mockClear();

      // Nested agent (child of root agent) with its own prompt B
      const nestedAgentSpan = createMockSpan({
        id: 'nested-agent-id',
        name: 'specialist-agent',
        type: SpanType.AGENT_RUN,
        isRoot: false,
        attributes: { agentId: 'specialist' },
        metadata: {
          langfuse: {
            prompt: {
              name: 'specialist-prompt',
              version: 3,
            },
          },
        },
      });
      nestedAgentSpan.traceId = 'root-agent-id';
      nestedAgentSpan.parentSpanId = 'root-agent-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: nestedAgentSpan,
      });

      // Nested agent's MODEL_GENERATION (should inherit specialist-prompt, NOT orchestrator-prompt)
      const nestedLlmSpan = createMockSpan({
        id: 'nested-llm-id',
        name: 'gpt-4-specialist',
        type: SpanType.MODEL_GENERATION,
        isRoot: false,
        attributes: { model: 'gpt-4' },
        metadata: {},
      });
      nestedLlmSpan.traceId = 'root-agent-id';
      nestedLlmSpan.parentSpanId = 'nested-agent-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: nestedLlmSpan,
      });

      // Should inherit from immediate parent (specialist-prompt), not root (orchestrator-prompt)
      expect(mockSpan.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'nested-llm-id',
          prompt: {
            name: 'specialist-prompt',
            version: 3,
          },
        }),
      );
    });

    it('should traverse up the span tree to find prompt from grandparent', async () => {
      // Root workflow (no prompt)
      const workflowSpan = createMockSpan({
        id: 'workflow-id',
        name: 'complex-workflow',
        type: SpanType.WORKFLOW_RUN,
        isRoot: true,
        attributes: {},
        metadata: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: workflowSpan,
      });

      // Agent with prompt (child of workflow)
      const agentSpan = createMockSpan({
        id: 'agent-id',
        name: 'analysis-agent',
        type: SpanType.AGENT_RUN,
        isRoot: false,
        attributes: {},
        metadata: {
          langfuse: {
            prompt: {
              name: 'analysis-prompt',
              version: 2,
            },
          },
        },
      });
      agentSpan.traceId = 'workflow-id';
      agentSpan.parentSpanId = 'workflow-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: agentSpan,
      });

      // Tool call span (no prompt) - child of agent
      const toolSpan = createMockSpan({
        id: 'tool-id',
        name: 'data-fetcher',
        type: SpanType.TOOL_CALL,
        isRoot: false,
        attributes: { toolId: 'data-fetcher' },
        metadata: {},
      });
      toolSpan.traceId = 'workflow-id';
      toolSpan.parentSpanId = 'agent-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: toolSpan,
      });

      // MODEL_GENERATION as child of tool (grandchild of agent)
      // Should traverse up to find agent's prompt
      const llmSpan = createMockSpan({
        id: 'llm-id',
        name: 'gpt-4-analyze',
        type: SpanType.MODEL_GENERATION,
        isRoot: false,
        attributes: { model: 'gpt-4' },
        metadata: {},
      });
      llmSpan.traceId = 'workflow-id';
      llmSpan.parentSpanId = 'tool-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      // Should find prompt from grandparent (agent)
      expect(mockSpan.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'llm-id',
          prompt: {
            name: 'analysis-prompt',
            version: 2,
          },
        }),
      );
    });

    it('should handle mixed scenario: some agents with prompts, some without', async () => {
      // Root workflow
      const workflowSpan = createMockSpan({
        id: 'workflow-id',
        name: 'mixed-workflow',
        type: SpanType.WORKFLOW_RUN,
        isRoot: true,
        attributes: {},
        metadata: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: workflowSpan,
      });

      // Agent 1 WITH prompt
      const agent1Span = createMockSpan({
        id: 'agent-1-id',
        name: 'prompted-agent',
        type: SpanType.AGENT_RUN,
        isRoot: false,
        attributes: {},
        metadata: {
          langfuse: {
            prompt: {
              name: 'my-prompt',
              version: 1,
            },
          },
        },
      });
      agent1Span.traceId = 'workflow-id';
      agent1Span.parentSpanId = 'workflow-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: agent1Span,
      });

      // Agent 1's LLM - should have prompt
      const llm1Span = createMockSpan({
        id: 'llm-1-id',
        name: 'gpt-4-prompted',
        type: SpanType.MODEL_GENERATION,
        isRoot: false,
        attributes: { model: 'gpt-4' },
        metadata: {},
      });
      llm1Span.traceId = 'workflow-id';
      llm1Span.parentSpanId = 'agent-1-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llm1Span,
      });

      expect(mockSpan.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'llm-1-id',
          prompt: {
            name: 'my-prompt',
            version: 1,
          },
        }),
      );

      mockSpan.generation.mockClear();

      // Agent 2 WITHOUT prompt
      const agent2Span = createMockSpan({
        id: 'agent-2-id',
        name: 'unprompted-agent',
        type: SpanType.AGENT_RUN,
        isRoot: false,
        attributes: {},
        metadata: {
          customField: 'some-value',
        },
      });
      agent2Span.traceId = 'workflow-id';
      agent2Span.parentSpanId = 'workflow-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: agent2Span,
      });

      // Agent 2's LLM - should NOT have prompt (no ancestor has one)
      const llm2Span = createMockSpan({
        id: 'llm-2-id',
        name: 'gpt-4-unprompted',
        type: SpanType.MODEL_GENERATION,
        isRoot: false,
        attributes: { model: 'gpt-4' },
        metadata: {},
      });
      llm2Span.traceId = 'workflow-id';
      llm2Span.parentSpanId = 'agent-2-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llm2Span,
      });

      // Should NOT have prompt
      const call = mockSpan.generation.mock.calls[0][0];
      expect(call.prompt).toBeUndefined();
    });

    it('should handle deeply nested structure with prompt at different levels', async () => {
      // Root workflow (no prompt)
      const workflowSpan = createMockSpan({
        id: 'workflow-id',
        name: 'deep-workflow',
        type: SpanType.WORKFLOW_RUN,
        isRoot: true,
        attributes: {},
        metadata: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: workflowSpan,
      });

      // Step 1 (no prompt)
      const step1Span = createMockSpan({
        id: 'step-1-id',
        name: 'step-1',
        type: SpanType.WORKFLOW_STEP,
        isRoot: false,
        attributes: {},
        metadata: {},
      });
      step1Span.traceId = 'workflow-id';
      step1Span.parentSpanId = 'workflow-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: step1Span,
      });

      // Agent inside step 1 (WITH prompt)
      const agentSpan = createMockSpan({
        id: 'agent-id',
        name: 'deep-agent',
        type: SpanType.AGENT_RUN,
        isRoot: false,
        attributes: {},
        metadata: {
          langfuse: {
            prompt: {
              name: 'deep-prompt',
              version: 7,
            },
          },
        },
      });
      agentSpan.traceId = 'workflow-id';
      agentSpan.parentSpanId = 'step-1-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: agentSpan,
      });

      // Tool inside agent (no prompt)
      const toolSpan = createMockSpan({
        id: 'tool-id',
        name: 'deep-tool',
        type: SpanType.TOOL_CALL,
        isRoot: false,
        attributes: {},
        metadata: {},
      });
      toolSpan.traceId = 'workflow-id';
      toolSpan.parentSpanId = 'agent-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: toolSpan,
      });

      // MODEL_GENERATION at the deepest level
      const llmSpan = createMockSpan({
        id: 'llm-id',
        name: 'gpt-4-deep',
        type: SpanType.MODEL_GENERATION,
        isRoot: false,
        attributes: { model: 'gpt-4' },
        metadata: {},
      });
      llmSpan.traceId = 'workflow-id';
      llmSpan.parentSpanId = 'tool-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      // Should traverse: llm -> tool -> agent (found prompt!) -> stop
      expect(mockSpan.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'llm-id',
          prompt: {
            name: 'deep-prompt',
            version: 7,
          },
        }),
      );
    });

    it('should use closest ancestor prompt when multiple ancestors have prompts', async () => {
      // Root agent with prompt A
      const rootAgentSpan = createMockSpan({
        id: 'root-agent-id',
        name: 'root-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
        metadata: {
          langfuse: {
            prompt: {
              name: 'root-prompt',
              version: 1,
            },
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootAgentSpan,
      });

      // Middle agent with prompt B (child of root)
      const middleAgentSpan = createMockSpan({
        id: 'middle-agent-id',
        name: 'middle-agent',
        type: SpanType.AGENT_RUN,
        isRoot: false,
        attributes: {},
        metadata: {
          langfuse: {
            prompt: {
              name: 'middle-prompt',
              version: 2,
            },
          },
        },
      });
      middleAgentSpan.traceId = 'root-agent-id';
      middleAgentSpan.parentSpanId = 'root-agent-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: middleAgentSpan,
      });

      // Leaf agent with prompt C (child of middle)
      const leafAgentSpan = createMockSpan({
        id: 'leaf-agent-id',
        name: 'leaf-agent',
        type: SpanType.AGENT_RUN,
        isRoot: false,
        attributes: {},
        metadata: {
          langfuse: {
            prompt: {
              name: 'leaf-prompt',
              version: 3,
            },
          },
        },
      });
      leafAgentSpan.traceId = 'root-agent-id';
      leafAgentSpan.parentSpanId = 'middle-agent-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: leafAgentSpan,
      });

      // MODEL_GENERATION under leaf agent
      const llmSpan = createMockSpan({
        id: 'llm-id',
        name: 'gpt-4-leaf',
        type: SpanType.MODEL_GENERATION,
        isRoot: false,
        attributes: { model: 'gpt-4' },
        metadata: {},
      });
      llmSpan.traceId = 'root-agent-id';
      llmSpan.parentSpanId = 'leaf-agent-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      // Should use closest ancestor's prompt (leaf-prompt), not root or middle
      expect(mockSpan.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'llm-id',
          prompt: {
            name: 'leaf-prompt',
            version: 3,
          },
        }),
      );
    });
  });

  describe('Tags Support', () => {
    it('should include tags in trace payload for root spans with tags', async () => {
      const rootSpanWithTags = createMockSpan({
        id: 'root-with-tags',
        name: 'tagged-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: { agentId: 'agent-123' },
        metadata: { userId: 'user-456' },
        tags: ['production', 'experiment-v2', 'user-request'],
      });

      const event: TracingEvent = {
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpanWithTags,
      };

      await exporter.exportTracingEvent(event);

      // Should create Langfuse trace with tags
      expect(mockLangfuseClient.trace).toHaveBeenCalledWith({
        id: 'root-with-tags',
        name: 'tagged-agent',
        userId: 'user-456',
        metadata: {
          agentId: 'agent-123',
          spanType: 'agent_run',
        },
        tags: ['production', 'experiment-v2', 'user-request'],
      });
    });

    it('should not include tags in trace payload when tags array is empty', async () => {
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

      // Should create Langfuse trace without tags property
      expect(mockLangfuseClient.trace).toHaveBeenCalledWith({
        id: 'root-empty-tags',
        name: 'agent-no-tags',
        metadata: {
          agentId: 'agent-123',
          spanType: 'agent_run',
        },
      });
      // Verify tags is not in the call
      const traceCall = mockLangfuseClient.trace.mock.calls[0][0];
      expect(traceCall.tags).toBeUndefined();
    });

    it('should not include tags in trace payload when tags is undefined', async () => {
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

      // Should create Langfuse trace without tags property
      const traceCall = mockLangfuseClient.trace.mock.calls[0][0];
      expect(traceCall.tags).toBeUndefined();
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

      // Should create Langfuse trace with tags
      expect(mockLangfuseClient.trace).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'workflow-with-tags',
          name: 'data-processing-workflow',
          tags: ['batch-processing', 'priority-high'],
        }),
      );
    });

    it('should not include tags for child spans (only root spans get tags)', async () => {
      // First create a root span with tags
      const rootSpan = createMockSpan({
        id: 'root-span-id',
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

      // Clear mock to check child span call
      mockLangfuseClient.trace.mockClear();
      mockSpan.span.mockClear();

      // Create child span (should not have tags even if we set them)
      // Child spans should not have tags set by the system
      // but let's verify the exporter handles it correctly even if accidentally set
      const childSpan = createMockSpan({
        id: 'child-span-id',
        name: 'child-tool',
        type: SpanType.TOOL_CALL,
        isRoot: false,
        attributes: { toolId: 'calculator' },
        tags: ['should-not-appear'],
      });
      childSpan.traceId = 'root-span-id';
      childSpan.parentSpanId = 'root-span-id';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: childSpan,
      });

      // Should not create new trace for child spans
      expect(mockLangfuseClient.trace).not.toHaveBeenCalled();

      // Span should be created on the parent span, not the trace
      expect(mockSpan.span).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'child-span-id',
          name: 'child-tool',
        }),
      );
      // The span call should not include tags (tags are only in trace payload)
      const spanCall = mockSpan.span.mock.calls[0][0];
      expect(spanCall.tags).toBeUndefined();
    });
  });

  describe('Time to First Token (TTFT) Support', () => {
    it('should include completionStartTime in generation payload for streaming responses', async () => {
      // Create a streaming MODEL_GENERATION span with completionStartTime
      const requestStartTime = new Date('2024-01-15T10:00:00.000Z');
      const firstTokenTime = new Date('2024-01-15T10:00:00.150Z'); // 150ms later

      const llmSpan = createMockSpan({
        id: 'llm-streaming-ttft',
        name: 'gpt-4-streaming',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        input: { messages: [{ role: 'user', content: 'Hello' }] },
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          streaming: true,
          completionStartTime: firstTokenTime, // When first token was received
        },
      });
      llmSpan.startTime = requestStartTime;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      // Verify completionStartTime is passed to Langfuse for TTFT calculation
      expect(mockTrace.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'llm-streaming-ttft',
          name: 'gpt-4-streaming',
          startTime: requestStartTime,
          completionStartTime: firstTokenTime,
          model: 'gpt-4',
        }),
      );
    });

    it('should not include completionStartTime when not provided (non-streaming)', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-non-streaming',
        name: 'gpt-4-generate',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          streaming: false,
          // No completionStartTime for non-streaming requests
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      const generationCall = mockTrace.generation.mock.calls[0][0];
      expect(generationCall.completionStartTime).toBeUndefined();
    });

    it('should include completionStartTime when updating generation span with first token timing', async () => {
      const requestStartTime = new Date('2024-01-15T10:00:00.000Z');
      const firstTokenTime = new Date('2024-01-15T10:00:00.200Z'); // 200ms TTFT

      // First, start the span without completionStartTime
      const llmSpan = createMockSpan({
        id: 'llm-update-ttft',
        name: 'claude-streaming',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: {
          model: 'claude-3-sonnet',
          provider: 'anthropic',
          streaming: true,
        },
      });
      llmSpan.startTime = requestStartTime;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      // Then update with completionStartTime when first token arrives
      llmSpan.attributes = {
        ...llmSpan.attributes,
        completionStartTime: firstTokenTime,
      } as any;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: llmSpan,
      });

      // Verify the update includes completionStartTime
      expect(mockGeneration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          completionStartTime: firstTokenTime,
        }),
      );
    });
  });

  describe('Shutdown', () => {
    it('should shutdown Langfuse client and clear maps', async () => {
      // Add some data to internal maps
      const exportedSpan = createMockSpan({
        id: 'test-span',
        name: 'test',
        type: SpanType.GENERIC,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan,
      });

      // Verify maps have data
      const traceData = exporter._getTraceData('test-span');
      expect(traceData.activeSpanCount()).toBeGreaterThan(0);

      // Shutdown
      await exporter.shutdown();

      // Verify Langfuse client shutdown was called
      expect(mockLangfuseClient.shutdownAsync).toHaveBeenCalled();

      // Verify maps were cleared
      expect(exporter._traceMapSize).toBe(0);
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
  parentSpanId,
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
  parentSpanId?: string;
}): AnyExportedSpan {
  return {
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
    isRootSpan: isRoot,
    parentSpanId: parentSpanId ?? (isRoot ? undefined : 'parent-id'),
    isEvent: false,
  };
}
