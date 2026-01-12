import type { Mutable } from '@arizeai/openinference-genai/types';
import { SemanticConventions } from '@arizeai/openinference-semantic-conventions';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ArizeExporter } from './tracing';

// Capture spans exported by the mocked OTLP exporter
const exportedSpans: any[] = [];

// Mock the OTLP exporter base class (used by OpenInferenceOTLPTraceExporter)
// IMPORTANT: define export as a prototype method so subclass overrides still run
vi.mock('@opentelemetry/exporter-trace-otlp-proto', () => {
  class MockOTLPTraceExporter {
    export(spans: any[], resultCallback?: (result: any) => void) {
      exportedSpans.push(...spans);
      if (resultCallback) resultCallback({});
    }
    shutdown() {
      return Promise.resolve();
    }
  }
  return { OTLPTraceExporter: MockOTLPTraceExporter };
});

// Mock resources API used by OtelExporter
vi.mock('@opentelemetry/resources', () => ({
  defaultResource: vi.fn().mockReturnValue({
    merge: vi.fn().mockReturnValue({}),
  }),
  resourceFromAttributes: vi.fn().mockReturnValue({
    merge: vi.fn().mockReturnValue({}),
  }),
}));

// Mock BatchSpanProcessor to immediately forward spans to the exporter
vi.mock('@opentelemetry/sdk-trace-base', () => {
  class MockBatchSpanProcessor {
    private exporter: any;
    constructor(exporter: any) {
      this.exporter = exporter;
    }
    onEnd(span: any) {
      this.exporter.export([span], () => {});
    }
    shutdown() {
      return Promise.resolve();
    }
  }
  return {
    BatchSpanProcessor: MockBatchSpanProcessor,
  };
});

describe('ArizeExporter', () => {
  let exporter: ArizeExporter | undefined;

  beforeEach(() => {
    exportedSpans.length = 0;
  });

  afterEach(async () => {
    if (exporter) {
      await exporter.shutdown();
      exporter = undefined;
    }
  });

  it('instantiates and exports a span via mocked BatchSpanProcessor', async () => {
    exporter = new ArizeExporter({
      endpoint: 'http://localhost:4318/v1/traces',
      apiKey: 'test-api-key',
      projectName: 'test-project',
    });

    const testSpan: Mutable<AnyExportedSpan> = {
      id: 'span-1',
      traceId: 'trace-1',
      type: SpanType.MODEL_GENERATION,
      name: 'Test LLM Generation',
      startTime: new Date(),
      endTime: new Date(),
      input: {
        // @todo: update this shape to match standard Mastra message shape
        // when implemented
        messages: [
          {
            role: 'system',
            content: [
              {
                type: 'text',
                text: 'You are a helpful weather assistant.',
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What is the weather in Tokyo?',
              },
            ],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'Let me check the weather for you.',
              },
              {
                type: 'tool-call',
                toolName: 'weatherTool',
                toolCallId: 'weatherTool-1',
                input: {
                  city: 'Tokyo',
                },
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolName: 'weatherTool',
                toolCallId: 'weatherTool-1',
                output: {
                  value: {
                    city: 'Tokyo',
                    temperature: 70,
                    condition: 'sunny',
                  },
                },
              },
            ],
          },
        ],
      },
      output: {
        text: 'The weather in Tokyo is sunny.',
      },
      attributes: {
        model: 'gpt-4',
        provider: 'openai',
        usage: {
          inputTokens: 10,
          outputTokens: 5,
        },
      },
    } as unknown as AnyExportedSpan;

    await exporter.exportTracingEvent({
      type: TracingEventType.SPAN_ENDED,
      exportedSpan: testSpan,
    });

    expect(exporter).toBeDefined();
    expect(exportedSpans.length).toBe(1);

    expect(exportedSpans[0].attributes).toMatchInlineSnapshot(`
      {
        "input.mime_type": "application/json",
        "input.value": "[{"role":"system","parts":[{"type":"text","content":"You are a helpful weather assistant."}]},{"role":"user","parts":[{"type":"text","content":"What is the weather in Tokyo?"}]},{"role":"assistant","parts":[{"type":"text","content":"Let me check the weather for you."},{"type":"tool_call","id":"weatherTool-1","name":"weatherTool","arguments":"{\\"city\\":\\"Tokyo\\"}"}]},{"role":"tool","parts":[{"type":"tool_call_response","id":"weatherTool-1","name":"weatherTool","response":"{\\"city\\":\\"Tokyo\\",\\"temperature\\":70,\\"condition\\":\\"sunny\\"}"}]}]",
        "llm.input_messages.0.message.contents.0.message_content.text": "You are a helpful weather assistant.",
        "llm.input_messages.0.message.contents.0.message_content.type": "text",
        "llm.input_messages.0.message.role": "system",
        "llm.input_messages.1.message.contents.0.message_content.text": "What is the weather in Tokyo?",
        "llm.input_messages.1.message.contents.0.message_content.type": "text",
        "llm.input_messages.1.message.role": "user",
        "llm.input_messages.2.message.contents.0.message_content.text": "Let me check the weather for you.",
        "llm.input_messages.2.message.contents.0.message_content.type": "text",
        "llm.input_messages.2.message.role": "assistant",
        "llm.input_messages.2.message.tool_calls.0.tool_call.function.arguments": ""{\\"city\\":\\"Tokyo\\"}"",
        "llm.input_messages.2.message.tool_calls.0.tool_call.function.name": "weatherTool",
        "llm.input_messages.2.message.tool_calls.0.tool_call.id": "weatherTool-1",
        "llm.input_messages.3.message.contents.0.message_content.text": "{"city":"Tokyo","temperature":70,"condition":"sunny"}",
        "llm.input_messages.3.message.contents.0.message_content.type": "text",
        "llm.input_messages.3.message.role": "tool",
        "llm.input_messages.3.message.tool_call_id": "weatherTool-1",
        "llm.invocation_parameters": "{"model":"gpt-4"}",
        "llm.model_name": "gpt-4",
        "llm.output_messages.0.message.contents.0.message_content.text": "The weather in Tokyo is sunny.",
        "llm.output_messages.0.message.contents.0.message_content.type": "text",
        "llm.output_messages.0.message.role": "assistant",
        "llm.provider": "openai",
        "llm.token_count.completion": 5,
        "llm.token_count.prompt": 10,
        "llm.token_count.total": 15,
        "mastra.span.type": "model_generation",
        "openinference.span.kind": "LLM",
        "output.mime_type": "application/json",
        "output.value": "[{"role":"assistant","parts":[{"type":"text","content":"The weather in Tokyo is sunny."}]}]",
      }
    `);
  });

  it('maps threadId and userId attributes to OpenInference session/user identifiers', async () => {
    exporter = new ArizeExporter({
      endpoint: 'http://localhost:4318/v1/traces',
    });

    const testSpan: Mutable<AnyExportedSpan> = {
      id: 'span-2',
      traceId: 'trace-2',
      type: SpanType.MODEL_GENERATION,
      name: 'Session/User Mapping',
      startTime: new Date(),
      endTime: new Date(),
      input: { messages: [] },
      output: { text: 'ok' },
      attributes: {
        model: 'gpt-4',
        provider: 'openai',
      },
      metadata: {
        threadId: 'thread-123',
        userId: 'user-456',
      },
    } as unknown as AnyExportedSpan;

    await exporter.exportTracingEvent({
      type: TracingEventType.SPAN_ENDED,
      exportedSpan: testSpan,
    });

    const exportedAttributes = exportedSpans[0].attributes;

    expect(exportedAttributes[SemanticConventions.SESSION_ID]).toBe('thread-123');
    expect(exportedAttributes[SemanticConventions.USER_ID]).toBe('user-456');
    expect(exportedAttributes.threadId).toBeUndefined();
    expect(exportedAttributes.userId).toBeUndefined();
  });

  it('includes custom attributes in OpenInference metadata payload', async () => {
    exporter = new ArizeExporter({
      endpoint: 'http://localhost:4318/v1/traces',
    });

    const testSpan: Mutable<AnyExportedSpan> = {
      id: 'span-3',
      traceId: 'trace-3',
      type: SpanType.MODEL_GENERATION,
      name: 'Custom Metadata',
      startTime: new Date(),
      endTime: new Date(),
      input: { text: 'hi' },
      output: { text: 'hello' },
      attributes: {
        model: 'gpt-4',
        provider: 'openai',
      },
      metadata: {
        companyId: 'acme-co',
        featureFlag: 'beta',
        correlation_id: 'corr-123',
        threadId: 'should-not-appear',
      },
    } as unknown as AnyExportedSpan;

    await exporter.exportTracingEvent({
      type: TracingEventType.SPAN_ENDED,
      exportedSpan: testSpan,
    });

    const exportedAttributes = exportedSpans[0].attributes;
    const metadata = exportedAttributes[SemanticConventions.METADATA];
    expect(typeof metadata).toBe('string');
    const parsed = JSON.parse(metadata as string);
    expect(parsed).toMatchObject({
      companyId: 'acme-co',
      featureFlag: 'beta',
      correlation_id: 'corr-123',
    });
    expect(parsed.threadId).toBeUndefined();
  });

  describe('Usage Metrics Conversion', () => {
    it('handles partial usage metrics gracefully', async () => {
      exporter = new ArizeExporter({
        endpoint: 'http://localhost:4318/v1/traces',
      });

      const testSpan: Mutable<AnyExportedSpan> = {
        id: 'span-partial-usage',
        traceId: 'trace-partial-usage',
        type: SpanType.MODEL_GENERATION,
        name: 'Partial Usage Test',
        startTime: new Date(),
        endTime: new Date(),
        input: { text: 'test' },
        output: { text: 'response' },
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          usage: {
            // Only input tokens, no output tokens
            inputTokens: 100,
          },
        },
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: testSpan,
      });

      expect(exportedSpans.length).toBe(1);
      const attrs = exportedSpans[0].attributes;

      // Input tokens should be present
      expect(attrs[SemanticConventions.LLM_TOKEN_COUNT_PROMPT]).toBe(100);

      // Output and total should NOT be present (undefined, not 0)
      expect(attrs[SemanticConventions.LLM_TOKEN_COUNT_COMPLETION]).toBeUndefined();
      expect(attrs[SemanticConventions.LLM_TOKEN_COUNT_TOTAL]).toBeUndefined();

      // Cache/reasoning/audio should not be present
      expect(attrs[SemanticConventions.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ]).toBeUndefined();
      expect(attrs[SemanticConventions.LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING]).toBeUndefined();
    });

    it('converts detailed usage metrics to OpenInference token count attributes', async () => {
      exporter = new ArizeExporter({
        endpoint: 'http://localhost:4318/v1/traces',
      });

      const testSpan: Mutable<AnyExportedSpan> = {
        id: 'span-usage',
        traceId: 'trace-usage',
        type: SpanType.MODEL_GENERATION,
        name: 'Detailed Usage Test',
        startTime: new Date(),
        endTime: new Date(),
        input: { text: 'test' },
        output: { text: 'response' },
        attributes: {
          model: 'claude-3-opus',
          provider: 'anthropic',
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            inputDetails: {
              cacheRead: 80,
              cacheWrite: 20,
              audio: 10,
            },
            outputDetails: {
              reasoning: 30,
              audio: 5,
            },
          },
        },
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: testSpan,
      });

      expect(exportedSpans.length).toBe(1);
      const attrs = exportedSpans[0].attributes;

      // Core token counts
      expect(attrs[SemanticConventions.LLM_TOKEN_COUNT_PROMPT]).toBe(100);
      expect(attrs[SemanticConventions.LLM_TOKEN_COUNT_COMPLETION]).toBe(50);
      expect(attrs[SemanticConventions.LLM_TOKEN_COUNT_TOTAL]).toBe(150);

      // Cache details
      expect(attrs[SemanticConventions.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ]).toBe(80);
      expect(attrs[SemanticConventions.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE]).toBe(20);

      // Reasoning tokens
      expect(attrs[SemanticConventions.LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING]).toBe(30);

      // Audio tokens
      expect(attrs[SemanticConventions.LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO]).toBe(10);
      expect(attrs[SemanticConventions.LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO]).toBe(5);
    });
  });

  describe('Tags Support', () => {
    it('includes tags in the exported span attributes for root spans with tags', async () => {
      // This test verifies that tags are included in the exported data for Arize
      // using the native OpenInference tag.tags convention
      exporter = new ArizeExporter({
        endpoint: 'http://localhost:4318/v1/traces',
        projectName: 'test-project',
      });

      const rootSpanWithTags: Mutable<AnyExportedSpan> = {
        id: 'span-with-tags',
        traceId: 'trace-with-tags',
        type: SpanType.AGENT_RUN,
        name: 'Tagged Agent Run',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: true,
        input: { prompt: 'Hello' },
        output: { response: 'Hi there!' },
        attributes: {
          agentId: 'agent-123',
        },
        tags: ['production', 'experiment-v2', 'user-request'],
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: rootSpanWithTags,
      });

      expect(exportedSpans.length).toBe(1);
      const exportedAttributes = exportedSpans[0].attributes;

      // Tags should be present using OpenInference native tag.tags convention
      // Note: ArizeExporter receives JSON string from SpanConverter, passes it through to tag.tags
      expect(exportedAttributes[SemanticConventions.TAG_TAGS]).toBeDefined();
      expect(exportedAttributes[SemanticConventions.TAG_TAGS]).toBe(
        JSON.stringify(['production', 'experiment-v2', 'user-request']),
      );
      expect(exportedAttributes['mastra.tags']).toBeUndefined();
    });

    it('does not include tags for child spans', async () => {
      exporter = new ArizeExporter({
        endpoint: 'http://localhost:4318/v1/traces',
        projectName: 'test-project',
      });

      const childSpanWithTags: Mutable<AnyExportedSpan> = {
        id: 'child-span-with-tags',
        traceId: 'trace-parent',
        parentSpanId: 'parent-span-id',
        type: SpanType.TOOL_CALL,
        name: 'Child Tool',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: false,
        input: { args: {} },
        output: { result: 42 },
        attributes: {
          toolId: 'calculator',
        },
        // Tags should be ignored for child spans
        tags: ['should-not-appear'],
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: childSpanWithTags,
      });

      expect(exportedSpans.length).toBe(1);
      const exportedAttributes = exportedSpans[0].attributes;

      // Tags should NOT be present on child spans (neither mastra.tags nor tag.tags)
      expect(exportedAttributes['mastra.tags']).toBeUndefined();
      expect(exportedAttributes[SemanticConventions.TAG_TAGS]).toBeUndefined();
    });

    it('does not include tags when tags array is empty', async () => {
      exporter = new ArizeExporter({
        endpoint: 'http://localhost:4318/v1/traces',
        projectName: 'test-project',
      });

      const rootSpanEmptyTags: Mutable<AnyExportedSpan> = {
        id: 'span-empty-tags',
        traceId: 'trace-empty-tags',
        type: SpanType.AGENT_RUN,
        name: 'Agent No Tags',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: true,
        input: { prompt: 'Hello' },
        output: { response: 'Hi!' },
        attributes: {
          agentId: 'agent-123',
        },
        tags: [],
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: rootSpanEmptyTags,
      });

      expect(exportedSpans.length).toBe(1);
      const exportedAttributes = exportedSpans[0].attributes;

      // Tags should NOT be present when array is empty
      expect(exportedAttributes['mastra.tags']).toBeUndefined();
      expect(exportedAttributes[SemanticConventions.TAG_TAGS]).toBeUndefined();
    });

    it('includes tags with workflow spans', async () => {
      exporter = new ArizeExporter({
        endpoint: 'http://localhost:4318/v1/traces',
        projectName: 'test-project',
      });

      const workflowSpanWithTags: Mutable<AnyExportedSpan> = {
        id: 'workflow-with-tags',
        traceId: 'trace-workflow',
        type: SpanType.WORKFLOW_RUN,
        name: 'Data Processing Workflow',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: true,
        input: { data: [] },
        output: { processed: true },
        attributes: {
          workflowId: 'wf-123',
        },
        tags: ['batch-processing', 'priority-high'],
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: workflowSpanWithTags,
      });

      expect(exportedSpans.length).toBe(1);
      const exportedAttributes = exportedSpans[0].attributes;

      // Tags should be present using OpenInference native tag.tags convention
      // Note: ArizeExporter receives JSON string from SpanConverter, passes it through to tag.tags
      expect(exportedAttributes[SemanticConventions.TAG_TAGS]).toBeDefined();
      expect(exportedAttributes[SemanticConventions.TAG_TAGS]).toBe(
        JSON.stringify(['batch-processing', 'priority-high']),
      );
    });
  });
});
