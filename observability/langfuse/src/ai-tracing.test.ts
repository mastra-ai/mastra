/**
 * Langfuse Exporter Tests
 *
 * These tests focus on Langfuse-specific functionality:
 * - Langfuse client interactions
 * - Mapping logic (spans -> traces/generations/spans)
 * - Type-specific metadata extraction
 * - Langfuse-specific error handling
 */

import type { AITracingEvent, AnyAISpan, LLMGenerationAttributes, ToolCallAttributes } from '@mastra/core/ai-tracing';
import { AISpanType, AITracingEventType } from '@mastra/core/ai-tracing';
import { Langfuse } from 'langfuse';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LangfuseExporter } from './ai-tracing';
import type { LangfuseExporterConfig } from './ai-tracing';

// Mock Langfuse constructor (must be at the top level)
vi.mock('langfuse');

describe('LangfuseExporter', () => {
  // Mock objects
  let mockGeneration: any;
  let mockSpan: any;
  let mockTrace: any;
  let mockLangfuseClient: any;
  let LangfuseMock: any;

  let exporter: LangfuseExporter;
  let config: LangfuseExporterConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up mocks
    mockGeneration = {
      update: vi.fn(),
      event: vi.fn(),
    };

    mockSpan = {
      update: vi.fn(),
      generation: vi.fn().mockReturnValue(mockGeneration),
      span: vi.fn(),
      event: vi.fn(),
    };

    mockTrace = {
      generation: vi.fn().mockReturnValue(mockGeneration),
      span: vi.fn().mockReturnValue(mockSpan),
      update: vi.fn(),
      event: vi.fn(),
    };

    // Set up circular reference
    mockSpan.span.mockReturnValue(mockSpan);

    mockLangfuseClient = {
      trace: vi.fn().mockReturnValue(mockTrace),
      shutdownAsync: vi.fn().mockResolvedValue(undefined),
    };

    // Get the mocked Langfuse constructor and configure it
    LangfuseMock = vi.mocked(Langfuse);
    LangfuseMock.mockImplementation(() => mockLangfuseClient);

    config = {
      publicKey: 'test-public-key',
      secretKey: 'test-secret-key',
      baseUrl: 'https://test-langfuse.com',
      options: {
        debug: false,
        flushAt: 1,
        flushInterval: 1000,
      },
    };

    exporter = new LangfuseExporter(config);
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
  });

  describe('Trace Creation', () => {
    it('should create Langfuse trace for root spans', async () => {
      const rootSpan = createMockSpan({
        id: 'root-span-id',
        name: 'root-agent',
        type: AISpanType.AGENT_RUN,
        isRoot: true,
        attributes: {
          agentId: 'agent-123',
          instructions: 'Test agent',
          spanType: 'agent_run',
        },
        metadata: { userId: 'user-456', sessionId: 'session-789' },
      });

      const event: AITracingEvent = {
        type: AITracingEventType.SPAN_STARTED,
        span: rootSpan,
      };

      await exporter.exportEvent(event);

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
        type: AISpanType.TOOL_CALL,
        isRoot: false,
        attributes: { toolId: 'calculator' },
      });

      const event: AITracingEvent = {
        type: AITracingEventType.SPAN_STARTED,
        span: childSpan,
      };

      await exporter.exportEvent(event);

      // Should not create trace for child spans
      expect(mockLangfuseClient.trace).not.toHaveBeenCalled();
    });
  });

  describe('LLM Generation Mapping', () => {
    it('should create Langfuse generation for LLM_GENERATION spans', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-span-id',
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
            topP: 0.9,
          },
          streaming: false,
          resultType: 'response_generation',
        },
      });

      const event: AITracingEvent = {
        type: AITracingEventType.SPAN_STARTED,
        span: llmSpan,
      };

      await exporter.exportEvent(event);

      // Should create Langfuse generation with LLM-specific fields
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
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        },
        metadata: {
          provider: 'openai',
          resultType: 'response_generation',
          spanType: 'llm_generation',
          streaming: false,
        },
      });
    });

    it('should handle LLM spans without optional fields', async () => {
      const minimalLlmSpan = createMockSpan({
        id: 'minimal-llm',
        name: 'simple-llm',
        type: AISpanType.LLM_GENERATION,
        isRoot: true,
        attributes: {
          model: 'gpt-3.5-turbo',
          // No usage, parameters, input, output, etc.
        },
      });

      const event: AITracingEvent = {
        type: AITracingEventType.SPAN_STARTED,
        span: minimalLlmSpan,
      };

      await exporter.exportEvent(event);

      expect(mockTrace.generation).toHaveBeenCalledWith({
        id: 'minimal-llm',
        name: 'simple-llm',
        startTime: minimalLlmSpan.startTime,
        model: 'gpt-3.5-turbo',
        metadata: {
          spanType: 'llm_generation',
        },
      });
    });
  });

  describe('Regular Span Mapping', () => {
    it('should create Langfuse span for non-LLM span types', async () => {
      const toolSpan = createMockSpan({
        id: 'tool-span-id',
        name: 'calculator-tool',
        type: AISpanType.TOOL_CALL,
        isRoot: true,
        input: { operation: 'add', a: 2, b: 3 },
        output: { result: 5 },
        attributes: {
          toolId: 'calculator',
          success: true,
        },
      });

      const event: AITracingEvent = {
        type: AITracingEventType.SPAN_STARTED,
        span: toolSpan,
      };

      await exporter.exportEvent(event);

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
        type: AISpanType.AGENT_RUN,
        isRoot: true,
        attributes: {
          agentId: 'agent-456',
          availableTools: ['search', 'calculator'],
          maxSteps: 10,
          currentStep: 3,
          instructions: 'Help customers',
        },
      });

      const event: AITracingEvent = {
        type: AITracingEventType.SPAN_STARTED,
        span: agentSpan,
      };

      await exporter.exportEvent(event);

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
        type: AISpanType.MCP_TOOL_CALL,
        isRoot: true,
        attributes: {
          toolId: 'file-reader',
          mcpServer: 'filesystem-mcp',
          serverVersion: '1.0.0',
          success: true,
        },
      });

      const event: AITracingEvent = {
        type: AITracingEventType.SPAN_STARTED,
        span: mcpSpan,
      };

      await exporter.exportEvent(event);

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
        type: AISpanType.WORKFLOW_RUN,
        isRoot: true,
        attributes: {
          workflowId: 'wf-123',
          status: 'running',
        },
      });

      const event: AITracingEvent = {
        type: AITracingEventType.SPAN_STARTED,
        span: workflowSpan,
      };

      await exporter.exportEvent(event);

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
        name: 'gpt-4-call',
        type: AISpanType.LLM_GENERATION,
        isRoot: true,
        attributes: { model: 'gpt-4' },
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: llmSpan,
      });

      // Then update it
      llmSpan.attributes = {
        ...llmSpan.attributes,
        usage: { totalTokens: 150 },
      } as LLMGenerationAttributes;
      llmSpan.output = { content: 'Updated response' };

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_UPDATED,
        span: llmSpan,
      });

      expect(mockGeneration.update).toHaveBeenCalledWith({
        metadata: expect.objectContaining({
          spanType: 'llm_generation',
        }),
        model: 'gpt-4',
        output: { content: 'Updated response' },
        usage: {
          totalTokens: 150,
        },
      });
    });

    it('should update regular spans', async () => {
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

      // Update with success
      toolSpan.attributes = {
        ...toolSpan.attributes,
        success: true,
      } as ToolCallAttributes;
      toolSpan.output = { result: 42 };

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_UPDATED,
        span: toolSpan,
      });

      expect(mockSpan.update).toHaveBeenCalledWith({
        metadata: expect.objectContaining({
          spanType: 'tool_call',
          success: true,
        }),
        output: { result: 42 },
      });
    });
  });

  describe('Span Ending', () => {
    it('should update span with endTime on span end', async () => {
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

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span,
      });

      expect(mockSpan.update).toHaveBeenCalledWith({
        endTime: span.endTime,
        metadata: expect.objectContaining({
          spanType: 'generic',
        }),
      });
    });

    it('should update span with error information on span end', async () => {
      const errorSpan = createMockSpan({
        id: 'error-span',
        name: 'failing-operation',
        type: AISpanType.TOOL_CALL,
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

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: errorSpan,
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: errorSpan,
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

    it('should update root trace and delete from traceMap when root span ends', async () => {
      const rootSpan = createMockSpan({
        id: 'root-span-id',
        name: 'root-span',
        type: AISpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
      });

      rootSpan.output = { result: 'success' };
      rootSpan.endTime = new Date();

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: rootSpan,
      });

      // Verify trace was created
      expect((exporter as any).traceMap.has('root-span-id')).toBe(true);

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: rootSpan,
      });

      // Should update trace with output
      expect(mockTrace.update).toHaveBeenCalledWith({
        output: { result: 'success' },
      });

      // Should remove trace from traceMap
      expect((exporter as any).traceMap.has('root-span-id')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing traces gracefully', async () => {
      const orphanSpan = createMockSpan({
        id: 'orphan-span',
        name: 'orphan',
        type: AISpanType.TOOL_CALL,
        isRoot: false, // Child span without parent trace
        attributes: { toolId: 'orphan-tool' },
      });

      // Should not throw when trying to create child span without trace
      await expect(
        exporter.exportEvent({
          type: AITracingEventType.SPAN_STARTED,
          span: orphanSpan,
        }),
      ).resolves.not.toThrow();

      // Should not create Langfuse span
      expect(mockTrace.span).not.toHaveBeenCalled();
      expect(mockTrace.generation).not.toHaveBeenCalled();
    });

    it('should handle missing Langfuse objects gracefully', async () => {
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
        type: AISpanType.GENERIC,
        isRoot: true,
        attributes: {
          eventType: 'user_feedback',
          rating: 5,
        },
        input: { message: 'Great response!' },
      });
      eventSpan.isEvent = true;

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: eventSpan,
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
        type: AISpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: rootSpan,
      });

      // Then create a child event span
      const childEventSpan = createMockSpan({
        id: 'child-event-id',
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
      childEventSpan.traceId = 'root-span-id';
      childEventSpan.parent = { id: 'root-span-id' };

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        span: childEventSpan,
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
        type: AISpanType.GENERIC,
        isRoot: false,
        attributes: {},
      });
      orphanEventSpan.isEvent = true;
      orphanEventSpan.traceId = 'missing-trace-id';

      // Should not throw
      await expect(
        exporter.exportEvent({
          type: AITracingEventType.SPAN_STARTED,
          span: orphanEventSpan,
        }),
      ).resolves.not.toThrow();

      // Should not create any Langfuse objects
      expect(mockTrace.event).not.toHaveBeenCalled();
      expect(mockSpan.event).not.toHaveBeenCalled();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown Langfuse client and clear maps', async () => {
      // Add some data to internal maps
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

      // Verify maps have data
      expect((exporter as any).traceMap.size).toBeGreaterThan(0);
      expect((exporter as any).traceMap.get('test-span').spans.size).toBeGreaterThan(0);

      // Shutdown
      await exporter.shutdown();

      // Verify Langfuse client shutdown was called
      expect(mockLangfuseClient.shutdownAsync).toHaveBeenCalled();

      // Verify maps were cleared
      expect((exporter as any).traceMap.size).toBe(0);
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
    trace: {
      id: isRoot ? id : 'parent-trace-id',
      traceId: isRoot ? id : 'parent-trace-id',
    } as AnyAISpan,
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
