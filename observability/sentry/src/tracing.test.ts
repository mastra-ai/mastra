/**
 * Sentry Exporter Tests
 *
 * These tests focus on Sentry-specific functionality:
 * - Sentry client initialization
 * - Span creation and lifecycle
 * - Attribute mapping
 * - Error handling
 */

import type { TracingEvent, AnyExportedSpan, ToolCallAttributes } from '@mastra/core/observability';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import * as Sentry from '@sentry/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SentryExporter } from './tracing';
import type { SentryExporterConfig } from './tracing';

// Mock Sentry module
vi.mock('@sentry/node');

describe('SentryExporter', () => {
  // Mock objects
  let mockSpan: any;
  let mockChildSpan: any;
  let SentryMock: any;

  let exporter: SentryExporter;
  let config: SentryExporterConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up mock spans
    mockChildSpan = {
      setAttribute: vi.fn(),
      setAttributes: vi.fn(),
      setData: vi.fn(),
      setTag: vi.fn(),
      setStatus: vi.fn(),
      end: vi.fn(),
      startChild: vi.fn(),
    };

    mockSpan = {
      setAttribute: vi.fn(),
      setAttributes: vi.fn(),
      setData: vi.fn(),
      setTag: vi.fn(),
      setStatus: vi.fn(),
      end: vi.fn(),
      startChild: vi.fn().mockReturnValue(mockChildSpan),
    };

    // Make child span also able to create children
    mockChildSpan.startChild.mockReturnValue(mockChildSpan);

    // Mock Sentry functions
    SentryMock = vi.mocked(Sentry);
    SentryMock.init = vi.fn();
    SentryMock.startInactiveSpan = vi.fn().mockReturnValue(mockSpan);
    SentryMock.addBreadcrumb = vi.fn();
    SentryMock.captureException = vi.fn();
    SentryMock.flush = vi.fn().mockResolvedValue(true);
    SentryMock.close = vi.fn().mockResolvedValue(undefined);

    config = {
      dsn: 'https://test@test.sentry.io/123',
      environment: 'test',
      tracesSampleRate: 1.0,
    };

    exporter = new SentryExporter(config);
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(exporter.name).toBe('sentry');
      expect(SentryMock.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://test@test.sentry.io/123',
          environment: 'test',
          tracesSampleRate: 1.0,
        }),
      );
    });

    it('should use environment variables for DSN', () => {
      const originalEnv = process.env.SENTRY_DSN;
      process.env.SENTRY_DSN = 'https://env@env.sentry.io/456';

      // Create new exporter with env var
      new SentryExporter({});

      expect(SentryMock.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://env@env.sentry.io/456',
        }),
      );

      process.env.SENTRY_DSN = originalEnv;
    });

    it('should warn and disable exporter when DSN is missing', () => {
      // Ensure no DSN is available from environment
      const originalEnv = process.env.SENTRY_DSN;
      delete process.env.SENTRY_DSN;

      // ConsoleLogger uses console.info for warn level logging
      const mockConsoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});

      // Clear mock to isolate this test from previous Sentry.init calls
      SentryMock.init.mockClear();

      const exporterWithoutDsn = new SentryExporter({});

      expect(exporterWithoutDsn.name).toBe('sentry');
      // Verify warning was logged about missing DSN
      expect(mockConsoleInfo).toHaveBeenCalledWith(expect.stringContaining('DSN'));
      // Verify exporter is disabled
      expect(exporterWithoutDsn.isDisabled).toBe(true);
      // Should not have initialized Sentry without DSN
      expect(SentryMock.init).not.toHaveBeenCalled();

      mockConsoleInfo.mockRestore();
      process.env.SENTRY_DSN = originalEnv;
    });

    it('should apply default values', () => {
      const minimalConfig = {
        dsn: 'https://test@test.sentry.io/123',
      };

      const minimalExporter = new SentryExporter(minimalConfig);

      expect(minimalExporter.name).toBe('sentry');
      expect(SentryMock.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://test@test.sentry.io/123',
          environment: 'production',
          tracesSampleRate: 1.0,
        }),
      );
    });
  });

  describe('Span Creation', () => {
    it('should create root span for AGENT_RUN', async () => {
      const rootSpan: any = createMockSpan({
        id: 'root-span-id',
        name: 'customer-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {
          agentId: 'customer-agent',
          instructions: 'Help customers',
        },
      });
      rootSpan.entityName = 'customer-agent';

      const event: TracingEvent = {
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      };

      await exporter.exportTracingEvent(event);

      expect(SentryMock.startInactiveSpan).toHaveBeenCalledWith({
        op: 'gen_ai.invoke_agent',
        name: 'invoke_agent customer-agent',
        startTime: expect.any(Number),
        forceTransaction: true,
        parentSpan: undefined,
      });

      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'gen_ai.agent.name': 'customer-agent',
          'gen_ai.system_instructions': 'Help customers',
        }),
      );
    });

    it('should create child span under parent', async () => {
      // First create root span
      const rootSpan = createMockSpan({
        id: 'root-span-id',
        name: 'agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      });

      // Then create child span
      const childSpan = createMockSpan({
        id: 'child-span-id',
        name: 'gpt-4-call',
        type: SpanType.MODEL_GENERATION,
        isRoot: false,
        parentSpanId: 'root-span-id',
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: childSpan,
      });

      // Second startInactiveSpan call is for the child span
      expect(SentryMock.startInactiveSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          op: 'gen_ai.chat',
          name: 'chat gpt-4',
        }),
      );

      // Check attributes were set on the span returned by startInactiveSpan
      expect(mockSpan.setAttributes).toHaveBeenCalled();
      // Find the call that set MODEL_GENERATION attributes
      const modelGenCall = mockSpan.setAttributes.mock.calls.find(
        (call: any) => call[0]['gen_ai.request.model'] === 'gpt-4',
      );
      expect(modelGenCall).toBeDefined();
      expect(modelGenCall[0]).toEqual(
        expect.objectContaining({
          'gen_ai.provider.name': 'openai',
          'gen_ai.request.model': 'gpt-4',
        }),
      );
    });

    it('should convert event spans to breadcrumbs', async () => {
      SentryMock.addBreadcrumb = vi.fn();

      const eventSpan = createMockSpan({
        id: 'event-span',
        name: 'user-feedback',
        type: SpanType.GENERIC,
        isRoot: true,
        attributes: { rating: 5 },
        metadata: { userId: 'user-123' },
        input: { message: 'Great service!' },
      });
      eventSpan.isEvent = true;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: eventSpan,
      });

      // Should not create a span for events
      expect(SentryMock.startInactiveSpan).not.toHaveBeenCalled();

      // Should create a breadcrumb instead
      expect(SentryMock.addBreadcrumb).toHaveBeenCalledWith({
        type: 'default',
        category: SpanType.GENERIC,
        message: 'user-feedback',
        level: 'info',
        data: expect.objectContaining({
          spanId: 'event-span',
          traceId: eventSpan.traceId,
          metadata: { userId: 'user-123' },
          attributes: { rating: 5 },
        }),
        timestamp: expect.any(Number),
      });
    });

    it('should skip MODEL_CHUNK spans', async () => {
      const chunkSpan = createMockSpan({
        id: 'chunk-span',
        name: 'chunk-1',
        type: SpanType.MODEL_CHUNK,
        isRoot: false,
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: chunkSpan,
      });

      // Should not create any span or breadcrumb for chunks
      expect(SentryMock.startInactiveSpan).not.toHaveBeenCalled();
      expect(SentryMock.addBreadcrumb).not.toHaveBeenCalled();
    });
  });

  describe('Span Operation Types', () => {
    it.each([
      [SpanType.AGENT_RUN, true, 'gen_ai.invoke_agent'],
      [SpanType.MODEL_GENERATION, true, 'gen_ai.chat'],
      [SpanType.WORKFLOW_RUN, true, 'workflow.run'],
      [SpanType.MODEL_GENERATION, false, 'gen_ai.chat'],
      [SpanType.TOOL_CALL, false, 'gen_ai.execute_tool'],
      [SpanType.WORKFLOW_STEP, false, 'workflow.step'],
      [SpanType.WORKFLOW_CONDITIONAL, false, 'workflow.conditional'],
      [SpanType.WORKFLOW_PARALLEL, false, 'workflow.parallel'],
      [SpanType.WORKFLOW_LOOP, false, 'workflow.loop'],
      [SpanType.PROCESSOR_RUN, false, 'ai.processor'],
    ])('should map %s (isRoot=%s) to operation %s', async (spanType, isRoot, expectedOp) => {
      const span = createMockSpan({
        id: 'test-span',
        name: 'test',
        type: spanType,
        isRoot,
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: span,
      });

      expect(SentryMock.startInactiveSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          op: expectedOp,
          forceTransaction: isRoot,
        }),
      );
    });
  });

  describe('Model Generation Attributes', () => {
    it('should set GenAI semantic attributes for MODEL_GENERATION', async () => {
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
          streaming: false,
          usage: {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
          },
          parameters: {
            temperature: 0.7,
            maxOutputTokens: 100,
            topP: 0.9,
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'gen_ai.provider.name': 'openai',
          'gen_ai.request.model': 'gpt-4',
          'gen_ai.usage.input_tokens': 10,
          'gen_ai.usage.output_tokens': 5,
          'gen_ai.request.temperature': 0.7,
          'gen_ai.request.max_tokens': 100,
          'gen_ai.request.top_p': 0.9,
          'gen_ai.request.stream': false,
          'gen_ai.response.streaming': false,
        }),
      );
    });

    it('should handle cached tokens', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-cached',
        name: 'claude-cached',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: {
          model: 'claude-3-5-sonnet',
          provider: 'anthropic',
          usage: {
            inputTokens: 150,
            outputTokens: 75,
            inputDetails: {
              cacheRead: 100,
              cacheWrite: 50,
            },
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'gen_ai.usage.input_tokens': 150,
          'gen_ai.usage.output_tokens': 75,
          'gen_ai.usage.cached_input_tokens': 100,
          'gen_ai.usage.cache_write_tokens': 50,
        }),
      );
    });

    it('should handle reasoning tokens', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-reasoning',
        name: 'o1-reasoning',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: {
          model: 'o1-preview',
          provider: 'openai',
          usage: {
            inputTokens: 100,
            outputTokens: 1050,
            outputDetails: {
              reasoning: 1000,
            },
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'gen_ai.usage.reasoning_tokens': 1000,
        }),
      );
    });

    it('should handle completion start time', async () => {
      const completionStartTime = new Date('2024-01-15T10:00:00.150Z');

      const llmSpan = createMockSpan({
        id: 'llm-streaming',
        name: 'gpt-4-streaming',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          streaming: true,
          completionStartTime,
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'gen_ai.completion_start_time': completionStartTime.toISOString(),
        }),
      );
    });
  });

  describe('Tool Call Attributes', () => {
    it('should set tool attributes for TOOL_CALL', async () => {
      const toolSpan = createMockSpan({
        id: 'tool-span',
        name: 'calculator',
        type: SpanType.TOOL_CALL,
        isRoot: true,
        input: { operation: 'add', a: 2, b: 3 },
        output: { result: 5 },
        attributes: {
          toolId: 'calculator',
          toolDescription: 'Performs mathematical calculations',
          success: true,
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: toolSpan,
      });

      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'gen_ai.tool.description': 'Performs mathematical calculations',
          'tool.success': true,
        }),
      );
    });
  });

  describe('Agent Attributes', () => {
    it('should set agent attributes for AGENT_RUN', async () => {
      const agentSpan: any = createMockSpan({
        id: 'agent-span',
        name: 'support-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {
          agentId: 'support-agent',
          instructions: 'Help customers with support requests',
          maxSteps: 10,
          currentStep: 3,
          availableTools: ['search', 'calculator', 'email'],
        },
      });
      agentSpan.entityName = 'support-agent';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: agentSpan,
      });

      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'gen_ai.agent.name': 'support-agent',
          'gen_ai.system_instructions': 'Help customers with support requests',
          'gen_ai.tool.definitions': '["search","calculator","email"]',
        }),
      );
    });
  });

  describe('Metadata and Tags', () => {
    it('should set metadata as attributes', async () => {
      const span = createMockSpan({
        id: 'span-with-metadata',
        name: 'test',
        type: SpanType.GENERIC,
        isRoot: true,
        attributes: {},
        metadata: {
          userId: 'user-123',
          sessionId: 'session-456',
          customField: 'custom-value',
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: span,
      });

      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'metadata.userId': 'user-123',
          'metadata.sessionId': 'session-456',
          'metadata.customField': 'custom-value',
        }),
      );
    });

    it('should set tags as attributes and tags', async () => {
      const span = createMockSpan({
        id: 'span-with-tags',
        name: 'test',
        type: SpanType.GENERIC,
        isRoot: true,
        attributes: {},
        tags: ['production', 'experiment-v2', 'user-request'],
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: span,
      });

      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: 'production,experiment-v2,user-request',
        }),
      );
    });

    it('should not include langfuse metadata', async () => {
      const span = createMockSpan({
        id: 'span-with-langfuse',
        name: 'test',
        type: SpanType.GENERIC,
        isRoot: true,
        attributes: {},
        metadata: {
          userId: 'user-123',
          langfuse: {
            prompt: { name: 'test-prompt', version: 1 },
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: span,
      });

      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'metadata.userId': 'user-123',
        }),
      );

      // Should NOT set langfuse metadata in Sentry
      const call = mockSpan.setAttributes.mock.calls[0][0];
      expect(call).not.toHaveProperty('metadata.langfuse');
    });
  });

  describe('Span Updates', () => {
    it('should update span attributes', async () => {
      const span = createMockSpan({
        id: 'update-span',
        name: 'test',
        type: SpanType.TOOL_CALL,
        isRoot: true,
        attributes: {
          toolType: 'calculator',
          success: false,
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: span,
      });

      // Update span attributes
      span.attributes = {
        ...span.attributes,
        success: true,
      } as ToolCallAttributes;
      span.output = { result: 42 };

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: span,
      });

      // End the span to finalize attributes (updates are applied on SPAN_ENDED)
      span.endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: span,
      });

      // Verify the updated attributes were applied when span ended
      const setAttributesCalls = mockSpan.setAttributes.mock.calls;
      const finalAttributesCall = setAttributesCalls.find((call: any) => call[0]['tool.success'] === true);
      expect(finalAttributesCall).toBeDefined();
      expect(finalAttributesCall[0]).toEqual(
        expect.objectContaining({
          'tool.success': true,
          output: JSON.stringify({ result: 42 }),
        }),
      );
    });

    it('should handle missing span gracefully', async () => {
      const orphanSpan = createMockSpan({
        id: 'orphan-span',
        name: 'orphan',
        type: SpanType.GENERIC,
        isRoot: true,
        attributes: {},
      });

      // Try to update without starting
      await expect(
        exporter.exportTracingEvent({
          type: TracingEventType.SPAN_UPDATED,
          exportedSpan: orphanSpan,
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('Span Ending', () => {
    it('should end span with timestamp', async () => {
      const span = createMockSpan({
        id: 'end-span',
        name: 'test',
        type: SpanType.GENERIC,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: span,
      });

      const endTime = new Date('2024-01-15T10:00:01.000Z');
      span.endTime = endTime;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: span,
      });

      expect(mockSpan.end).toHaveBeenCalledWith(endTime.getTime());
    });

    it('should handle errors and capture exception', async () => {
      const span = createMockSpan({
        id: 'error-span',
        name: 'failing-tool',
        type: SpanType.TOOL_CALL,
        isRoot: true,
        attributes: {
          toolId: 'failing-tool',
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: span,
      });

      // Add error info before ending
      span.errorInfo = {
        message: 'Tool execution failed',
        id: 'TOOL_ERROR',
        category: 'EXECUTION',
      };
      span.endTime = new Date();

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: span,
      });

      expect(SentryMock.captureException).toHaveBeenCalledWith(
        'Tool execution failed',
        expect.objectContaining({
          contexts: expect.objectContaining({
            trace: expect.objectContaining({
              trace_id: span.traceId,
              span_id: span.id,
            }),
          }),
        }),
      );
    });

    it('should remove span from map after ending', async () => {
      const span = createMockSpan({
        id: 'cleanup-span',
        name: 'test',
        type: SpanType.GENERIC,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: span,
      });

      // Verify span is in map
      expect((exporter as any).spanMap.has('cleanup-span')).toBe(true);

      span.endTime = new Date();

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: span,
      });

      // Verify span is removed from map
      expect((exporter as any).spanMap.has('cleanup-span')).toBe(false);
    });
  });

  describe('Token Usage Reporting', () => {
    it('should copy token usage from MODEL_GENERATION to AGENT_RUN parent', async () => {
      // Create agent (parent) span
      const agentSpan = createMockSpan({
        id: 'agent-span',
        name: 'test-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: {
          agentId: 'test-agent',
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: agentSpan,
      });

      // Create MODEL_GENERATION child span with token usage
      const llmSpan = createMockSpan({
        id: 'llm-span',
        name: 'gpt-4',
        type: SpanType.MODEL_GENERATION,
        isRoot: false,
        parentSpanId: 'agent-span',
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            inputDetails: {
              cacheRead: 20,
              cacheWrite: 10,
            },
            outputDetails: {
              reasoning: 30,
            },
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      // End the MODEL_GENERATION span - this stores usage in parent's generation field
      llmSpan.endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: llmSpan,
      });

      // End the AGENT_RUN span - this copies tokens from generation field
      agentSpan.endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: agentSpan,
      });

      // Verify tokens were copied to the parent span
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('gen_ai.usage.input_tokens', 100);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('gen_ai.usage.output_tokens', 50);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('gen_ai.usage.cache_read_input_tokens', 20);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('gen_ai.usage.cache_write_input_tokens', 10);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('gen_ai.usage.reasoning_tokens', 30);
    });

    it('should isolate token usage per AGENT_RUN (no cascading to parent agents)', async () => {
      // Create root agent span (has no MODEL_GENERATION child, so no tokens)
      const rootSpan = createMockSpan({
        id: 'root-agent',
        name: 'root',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: { agentId: 'root' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      });

      // Create nested agent span (e.g., called by InputProcessor/OutputProcessor)
      const nestedAgentSpan = createMockSpan({
        id: 'nested-agent',
        name: 'nested',
        type: SpanType.AGENT_RUN,
        isRoot: false,
        parentSpanId: 'root-agent',
        attributes: { agentId: 'nested' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: nestedAgentSpan,
      });

      // Create MODEL_GENERATION as child of nested agent
      const llmSpan = createMockSpan({
        id: 'llm-span',
        name: 'gpt-4',
        type: SpanType.MODEL_GENERATION,
        isRoot: false,
        parentSpanId: 'nested-agent',
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          usage: {
            inputTokens: 200,
            outputTokens: 100,
            totalTokens: 300,
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      // End spans in order
      llmSpan.endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: llmSpan,
      });

      nestedAgentSpan.endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: nestedAgentSpan,
      });

      rootSpan.endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: rootSpan,
      });

      // Nested agent should get tokens (200/100), but root agent should NOT
      // This prevents cross-model token aggregation when processors call nested agents
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('gen_ai.usage.input_tokens', 200);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('gen_ai.usage.output_tokens', 100);
    });

    it('should use tokens from the single MODEL_GENERATION child', async () => {
      // Create agent span
      const agentSpan = createMockSpan({
        id: 'agent-span',
        name: 'test-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: { agentId: 'test-agent' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: agentSpan,
      });

      // MODEL_GENERATION (there is only ever one per AGENT_RUN)
      const llm = createMockSpan({
        id: 'llm-1',
        name: 'gpt-4',
        type: SpanType.MODEL_GENERATION,
        isRoot: false,
        parentSpanId: 'agent-span',
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          usage: {
            inputTokens: 150,
            outputTokens: 75,
          },
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llm,
      });

      llm.endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: llm,
      });

      // End agent span
      agentSpan.endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: agentSpan,
      });

      // AGENT_RUN should report usage from the single MODEL_GENERATION child
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('gen_ai.usage.input_tokens', 150);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('gen_ai.usage.output_tokens', 75);
    });

    it('should not report tokens when MODEL_GENERATION has no usage data', async () => {
      const agentSpan = createMockSpan({
        id: 'agent-span',
        name: 'test-agent',
        type: SpanType.AGENT_RUN,
        isRoot: true,
        attributes: { agentId: 'test-agent' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: agentSpan,
      });

      const llmSpan = createMockSpan({
        id: 'llm-span',
        name: 'gpt-4',
        type: SpanType.MODEL_GENERATION,
        isRoot: false,
        parentSpanId: 'agent-span',
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          // No usage field
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      llmSpan.endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: llmSpan,
      });

      // End agent span to trigger token attribute application
      agentSpan.endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: agentSpan,
      });

      const setAttributeCalls = mockSpan.setAttribute.mock.calls.filter((call: any) =>
        call[0].startsWith('gen_ai.usage.'),
      );

      // Should not have set any token attributes
      expect(setAttributeCalls.length).toBe(0);
    });
  });

  describe('Tool Calls Tracking', () => {
    it('should add gen_ai.response.tool_calls when MODEL_GENERATION has TOOL_CALL children', async () => {
      // Create MODEL_GENERATION span
      const llmSpan = createMockSpan({
        id: 'llm-span',
        name: 'gpt-4',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      // Create TOOL_CALL child
      const toolCall1: any = createMockSpan({
        id: 'tool-1',
        name: 'calculator',
        type: SpanType.TOOL_CALL,
        isRoot: false,
        parentSpanId: 'llm-span',
        attributes: {
          toolId: 'calculator',
          toolType: 'function',
        },
        metadata: {
          toolCallId: 'call_123',
        },
      });
      toolCall1.entityName = 'calculator';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: toolCall1,
      });

      // Create another TOOL_CALL child
      const toolCall2: any = createMockSpan({
        id: 'tool-2',
        name: 'search',
        type: SpanType.TOOL_CALL,
        isRoot: false,
        parentSpanId: 'llm-span',
        attributes: {
          toolId: 'search',
        },
        metadata: {
          toolCallId: 'call_456',
        },
      });
      toolCall2.entityName = 'search';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: toolCall2,
      });

      // End the MODEL_GENERATION span - this should add tool_calls attribute
      llmSpan.endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: llmSpan,
      });

      // Verify gen_ai.response.tool_calls was set with JSON array
      const toolCallsSetCall = mockSpan.setAttribute.mock.calls.find(
        (call: any) => call[0] === 'gen_ai.response.tool_calls',
      );

      expect(toolCallsSetCall).toBeDefined();
      const toolCallsValue = JSON.parse(toolCallsSetCall[1]);
      expect(toolCallsValue).toHaveLength(2);
      expect(toolCallsValue[0]).toEqual({
        name: 'calculator',
        id: 'call_123',
        type: 'function',
      });
      expect(toolCallsValue[1]).toEqual({
        name: 'search',
        id: 'call_456',
        type: 'function',
      });
    });

    it('should not add tool_calls attribute when no TOOL_CALL children exist', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-span',
        name: 'gpt-4',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      llmSpan.endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: llmSpan,
      });

      // Should not have set tool_calls attribute
      const toolCallsSetCall = mockSpan.setAttribute.mock.calls.find(
        (call: any) => call[0] === 'gen_ai.response.tool_calls',
      );

      expect(toolCallsSetCall).toBeUndefined();
    });

    it('should only track TOOL_CALL children, not other span types', async () => {
      const llmSpan = createMockSpan({
        id: 'llm-span',
        name: 'gpt-4',
        type: SpanType.MODEL_GENERATION,
        isRoot: true,
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
        },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: llmSpan,
      });

      // Create a GENERIC child (should not be tracked)
      const genericChild = createMockSpan({
        id: 'generic-child',
        name: 'generic',
        type: SpanType.GENERIC,
        isRoot: false,
        parentSpanId: 'llm-span',
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: genericChild,
      });

      // Create a TOOL_CALL child (should be tracked)
      const toolCall: any = createMockSpan({
        id: 'tool-1',
        name: 'calculator',
        type: SpanType.TOOL_CALL,
        isRoot: false,
        parentSpanId: 'llm-span',
        attributes: {
          toolId: 'calculator',
        },
      });
      toolCall.entityName = 'calculator';

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: toolCall,
      });

      llmSpan.endTime = new Date();
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: llmSpan,
      });

      // Should only have one tool call (not the generic child)
      const toolCallsSetCall = mockSpan.setAttribute.mock.calls.find(
        (call: any) => call[0] === 'gen_ai.response.tool_calls',
      );

      expect(toolCallsSetCall).toBeDefined();
      const toolCallsValue = JSON.parse(toolCallsSetCall[1]);
      expect(toolCallsValue).toHaveLength(1);
      expect(toolCallsValue[0].name).toBe('calculator');
    });
  });

  describe('Shutdown', () => {
    it('should end all active spans and close Sentry', async () => {
      // Create multiple spans
      const span1 = createMockSpan({
        id: 'span-1',
        name: 'test-1',
        type: SpanType.GENERIC,
        isRoot: true,
        attributes: {},
      });

      const span2 = createMockSpan({
        id: 'span-2',
        name: 'test-2',
        type: SpanType.GENERIC,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: span1,
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: span2,
      });

      // Verify spans are in map
      expect((exporter as any).spanMap.size).toBe(2);

      // Shutdown
      await exporter.shutdown();

      // Verify all spans were ended
      expect(mockSpan.end).toHaveBeenCalledTimes(2);

      // Verify Sentry was closed
      expect(SentryMock.close).toHaveBeenCalledWith(2000);

      // Verify map was cleared
      expect((exporter as any).spanMap.size).toBe(0);
    });

    it('should handle errors during span cleanup', async () => {
      const span = createMockSpan({
        id: 'error-cleanup-span',
        name: 'test',
        type: SpanType.GENERIC,
        isRoot: true,
        attributes: {},
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: span,
      });

      // Make span.end throw an error
      mockSpan.end.mockImplementation(() => {
        throw new Error('End failed');
      });

      // Should not throw
      await expect(exporter.shutdown()).resolves.not.toThrow();

      // Should still close Sentry
      expect(SentryMock.close).toHaveBeenCalled();
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
    traceId: isRoot ? id : 'parent-trace-id',
    isRootSpan: isRoot,
    parentSpanId: parentSpanId ?? (isRoot ? undefined : 'parent-id'),
    isEvent: false,
  };
}
