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

  describe('Span Kind Mapping', () => {
    it('maps workflow_run spans to CHAIN span kind', async () => {
      exporter = new ArizeExporter({
        endpoint: 'http://localhost:4318/v1/traces',
      });

      const workflowRunSpan: Mutable<AnyExportedSpan> = {
        id: 'workflow-run-span',
        traceId: 'trace-workflow-run',
        type: SpanType.WORKFLOW_RUN,
        name: 'Data Processing Workflow',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: true,
        input: { data: [1, 2, 3] },
        output: { processed: true, count: 3 },
        attributes: {},
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: workflowRunSpan,
      });

      expect(exportedSpans.length).toBe(1);
      const attrs = exportedSpans[0].attributes;

      // Workflow spans should be mapped to CHAIN span kind, not LLM
      expect(attrs[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe('CHAIN');
    });

    it('maps workflow_step spans to CHAIN span kind', async () => {
      exporter = new ArizeExporter({
        endpoint: 'http://localhost:4318/v1/traces',
      });

      const workflowStepSpan: Mutable<AnyExportedSpan> = {
        id: 'workflow-step-span',
        traceId: 'trace-workflow-step',
        parentSpanId: 'parent-workflow',
        type: SpanType.WORKFLOW_STEP,
        name: 'Process Data Step',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: false,
        input: { item: 1 },
        output: { result: 'processed' },
        attributes: {},
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: workflowStepSpan,
      });

      expect(exportedSpans.length).toBe(1);
      const attrs = exportedSpans[0].attributes;

      // Workflow step spans should be mapped to CHAIN span kind
      expect(attrs[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe('CHAIN');
    });

    it('maps agent_run spans to AGENT span kind', async () => {
      exporter = new ArizeExporter({
        endpoint: 'http://localhost:4318/v1/traces',
      });

      const agentRunSpan: Mutable<AnyExportedSpan> = {
        id: 'agent-run-span',
        traceId: 'trace-agent-run',
        type: SpanType.AGENT_RUN,
        name: 'Customer Support Agent',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: true,
        input: { prompt: 'Hello' },
        output: { response: 'Hi there!' },
        attributes: {
          agentId: 'support-agent',
        },
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: agentRunSpan,
      });

      expect(exportedSpans.length).toBe(1);
      const attrs = exportedSpans[0].attributes;

      // Agent spans should be mapped to AGENT span kind
      expect(attrs[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe('AGENT');
    });

    it('maps model_generation spans to LLM span kind', async () => {
      exporter = new ArizeExporter({
        endpoint: 'http://localhost:4318/v1/traces',
      });

      const modelGenerationSpan: Mutable<AnyExportedSpan> = {
        id: 'model-gen-span',
        traceId: 'trace-model-gen',
        parentSpanId: 'parent-agent',
        type: SpanType.MODEL_GENERATION,
        name: 'gpt-4 generation',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: false,
        input: { messages: [{ role: 'user', content: 'Hello' }] },
        output: { text: 'Hi!' },
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
        },
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: modelGenerationSpan,
      });

      expect(exportedSpans.length).toBe(1);
      const attrs = exportedSpans[0].attributes;

      // Model generation spans should be mapped to LLM span kind
      expect(attrs[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe('LLM');
    });

    it('maps processor_run spans to CHAIN span kind', async () => {
      exporter = new ArizeExporter({
        endpoint: 'http://localhost:4318/v1/traces',
      });

      const processorRunSpan: Mutable<AnyExportedSpan> = {
        id: 'processor-run-span',
        traceId: 'trace-processor-run',
        parentSpanId: 'parent-agent',
        type: SpanType.PROCESSOR_RUN,
        name: 'Input Processor',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: false,
        input: { raw: 'input data' },
        output: { processed: 'transformed data' },
        attributes: {},
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: processorRunSpan,
      });

      expect(exportedSpans.length).toBe(1);
      const attrs = exportedSpans[0].attributes;

      // Processor spans should be mapped to CHAIN span kind
      expect(attrs[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe('CHAIN');
    });

    it('maps generic spans to CHAIN span kind', async () => {
      exporter = new ArizeExporter({
        endpoint: 'http://localhost:4318/v1/traces',
      });

      const genericSpan: Mutable<AnyExportedSpan> = {
        id: 'generic-span',
        traceId: 'trace-generic',
        parentSpanId: 'parent-workflow',
        type: SpanType.GENERIC,
        name: 'Custom Operation',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: false,
        input: { data: 'some input' },
        output: { result: 'some output' },
        attributes: {},
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: genericSpan,
      });

      expect(exportedSpans.length).toBe(1);
      const attrs = exportedSpans[0].attributes;

      // Generic spans should be mapped to CHAIN span kind
      expect(attrs[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe('CHAIN');
    });

    it('maps mcp_tool_call spans to TOOL span kind', async () => {
      exporter = new ArizeExporter({
        endpoint: 'http://localhost:4318/v1/traces',
      });

      const mcpToolCallSpan: Mutable<AnyExportedSpan> = {
        id: 'mcp-tool-span',
        traceId: 'trace-mcp-tool',
        parentSpanId: 'parent-agent',
        type: SpanType.MCP_TOOL_CALL,
        name: 'execute_tool filesystem.readFile',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: false,
        input: { path: '/tmp/file.txt' },
        output: { content: 'file contents' },
        attributes: {
          mcpServer: 'filesystem-server',
        },
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mcpToolCallSpan,
      });

      expect(exportedSpans.length).toBe(1);
      const attrs = exportedSpans[0].attributes;

      // MCP tool call spans should be mapped to TOOL span kind
      expect(attrs[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe('TOOL');
    });

    it('defaults unknown span types to CHAIN span kind', async () => {
      exporter = new ArizeExporter({
        endpoint: 'http://localhost:4318/v1/traces',
      });

      // Simulate a future span type that doesn't exist in the mapping
      const unknownSpan: Mutable<AnyExportedSpan> = {
        id: 'unknown-span',
        traceId: 'trace-unknown',
        type: 'some_future_span_type' as any,
        name: 'Future Operation',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: true,
        input: { data: 'input' },
        output: { result: 'output' },
        attributes: {},
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: unknownSpan,
      });

      expect(exportedSpans.length).toBe(1);
      const attrs = exportedSpans[0].attributes;

      // Unknown span types should default to CHAIN span kind
      expect(attrs[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe('CHAIN');
    });
  });

  describe('Tool Call Span Support', () => {
    it('maps tool call input/output to OpenInference INPUT_VALUE/OUTPUT_VALUE', async () => {
      exporter = new ArizeExporter({
        endpoint: 'http://localhost:4318/v1/traces',
      });

      const toolCallSpan: Mutable<AnyExportedSpan> = {
        id: 'tool-call-span',
        traceId: 'trace-tool-call',
        parentSpanId: 'parent-span',
        type: SpanType.TOOL_CALL,
        name: 'execute_tool weatherTool',
        entityId: 'weatherTool',
        entityName: 'weatherTool',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: false,
        input: { city: 'Tokyo' },
        output: { temperature: 72, condition: 'sunny' },
        attributes: {
          toolDescription: 'Get weather information for a city',
          toolType: 'function',
        },
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: toolCallSpan,
      });

      expect(exportedSpans.length).toBe(1);
      const attrs = exportedSpans[0].attributes;

      // Tool call input/output should be mapped to OpenInference INPUT_VALUE/OUTPUT_VALUE
      expect(attrs[SemanticConventions.INPUT_VALUE]).toBe(JSON.stringify({ city: 'Tokyo' }));
      expect(attrs[SemanticConventions.OUTPUT_VALUE]).toBe(JSON.stringify({ temperature: 72, condition: 'sunny' }));
      expect(attrs[SemanticConventions.INPUT_MIME_TYPE]).toBe('application/json');
      expect(attrs[SemanticConventions.OUTPUT_MIME_TYPE]).toBe('application/json');

      // Should have TOOL span kind
      expect(attrs[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe('TOOL');
    });
  });

  describe('Model Step Span Support', () => {
    it('maps model_step input/output to OpenInference INPUT_VALUE/OUTPUT_VALUE', async () => {
      exporter = new ArizeExporter({
        endpoint: 'http://localhost:4318/v1/traces',
      });

      const modelStepSpan: Mutable<AnyExportedSpan> = {
        id: 'model-step-span',
        traceId: 'trace-model-step',
        parentSpanId: 'parent-span',
        type: SpanType.MODEL_STEP,
        name: 'model_step gpt-4',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: false,
        input: { messages: [{ role: 'user', content: 'Hello' }] },
        output: { text: 'Hi there!' },
        attributes: {},
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: modelStepSpan,
      });

      expect(exportedSpans.length).toBe(1);
      const attrs = exportedSpans[0].attributes;

      // Model step input/output should be mapped to OpenInference INPUT_VALUE/OUTPUT_VALUE
      expect(attrs[SemanticConventions.INPUT_VALUE]).toBe(
        JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] }),
      );
      expect(attrs[SemanticConventions.OUTPUT_VALUE]).toBe(JSON.stringify({ text: 'Hi there!' }));
      expect(attrs[SemanticConventions.INPUT_MIME_TYPE]).toBe('application/json');
      expect(attrs[SemanticConventions.OUTPUT_MIME_TYPE]).toBe('application/json');
    });
  });

  describe('Model Chunk Span Support', () => {
    it('maps model_chunk output to OpenInference OUTPUT_VALUE and sets span name', async () => {
      exporter = new ArizeExporter({
        endpoint: 'http://localhost:4318/v1/traces',
      });

      const modelChunkSpan: Mutable<AnyExportedSpan> = {
        id: 'model-chunk-span',
        traceId: 'trace-model-chunk',
        parentSpanId: 'parent-span',
        type: SpanType.MODEL_CHUNK,
        name: 'model_chunk',
        entityName: 'gpt-4o',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: false,
        output: { delta: 'Hello' },
        attributes: {},
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: modelChunkSpan,
      });

      expect(exportedSpans.length).toBe(1);
      const attrs = exportedSpans[0].attributes;

      // Model chunk output should be mapped to OpenInference OUTPUT_VALUE
      expect(attrs[SemanticConventions.OUTPUT_VALUE]).toBe(JSON.stringify({ delta: 'Hello' }));
      expect(attrs[SemanticConventions.OUTPUT_MIME_TYPE]).toBe('application/json');

      // Span name should include entity name
      expect(exportedSpans[0].name).toBe('model_chunk gpt-4o');
    });
  });
});
