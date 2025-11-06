import type { Mutable } from '@arizeai/openinference-genai/types';
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
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
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
        "input.value": "{"messages":[{"role":"system","content":[{"type":"text","text":"You are a helpful weather assistant."}]},{"role":"user","content":[{"type":"text","text":"What is the weather in Tokyo?"}]},{"role":"assistant","content":[{"type":"text","text":"Let me check the weather for you."},{"type":"tool-call","toolName":"weatherTool","toolCallId":"weatherTool-1","input":{"city":"Tokyo"}}]},{"role":"tool","content":[{"type":"tool-result","toolName":"weatherTool","toolCallId":"weatherTool-1","output":{"value":{"city":"Tokyo","temperature":70,"condition":"sunny"}}}]}]}",
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
        "llm.token_count.completion": 5,
        "llm.token_count.prompt": 10,
        "llm.token_count.total": 15,
        "openinference.span.kind": "LLM",
        "output.mime_type": "application/json",
        "output.value": "{"text":"The weather in Tokyo is sunny."}",
      }
    `);
  });
});
