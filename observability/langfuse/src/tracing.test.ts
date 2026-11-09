import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LangfuseExporter, LANGFUSE_DEFAULT_BASE_URL } from './tracing';

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

// Track calls to LangfuseSpanProcessor
const processedSpans: any[] = [];
const mockForceFlush = vi.fn().mockResolvedValue(undefined);
const mockShutdown = vi.fn().mockResolvedValue(undefined);
const processorConstructorArgs: any[] = [];
const converterConstructorArgs: any[] = [];

vi.mock('@langfuse/otel', () => {
  class MockLangfuseSpanProcessor {
    onStart = vi.fn();
    onEnd = vi.fn().mockImplementation((span: any) => {
      processedSpans.push(span);
    });
    forceFlush = mockForceFlush;
    shutdown = mockShutdown;
    constructor(params: any) {
      processorConstructorArgs.push(params);
    }
  }
  return { LangfuseSpanProcessor: MockLangfuseSpanProcessor };
});

// Track calls to LangfuseClient
const mockScoreCreate = vi.fn();
const mockClientFlush = vi.fn().mockResolvedValue(undefined);
const mockClientShutdown = vi.fn().mockResolvedValue(undefined);
const clientConstructorArgs: any[] = [];
const originalLangfuseEnv = {
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL,
  environment: process.env.LANGFUSE_TRACING_ENVIRONMENT,
  release: process.env.LANGFUSE_RELEASE,
};

vi.mock('@langfuse/client', () => {
  class MockLangfuseClient {
    score = { create: mockScoreCreate };
    prompt = {};
    flush = mockClientFlush;
    shutdown = mockClientShutdown;
    constructor(params: any) {
      clientConstructorArgs.push(params);
    }
  }
  return { LangfuseClient: MockLangfuseClient };
});

vi.mock('@mastra/otel-exporter', () => {
  function ioAttributes(span: any, field: 'input' | 'output'): Record<string, string> {
    const value = span[field];
    if (value === undefined || !span.type) return {};
    let serialized: string;
    try {
      serialized = typeof value === 'string' ? value : JSON.stringify(value);
    } catch {
      return {};
    }
    const key =
      span.type === SpanType.MODEL_GENERATION
        ? `gen_ai.${field}.messages`
        : `mastra.${String(span.type).toLowerCase()}.${field}`;
    return { [key]: serialized };
  }

  // Mirrors the real SpanConverter's mastra.<span_type>.<snake_key> attributes
  // for the span types used in these tests.
  function spanTypeAttributes(span: any): Record<string, unknown> {
    const attrs = span.attributes ?? {};
    const prefix = `mastra.${String(span.type).toLowerCase()}.`;
    const out: Record<string, unknown> = {};
    if (span.type === SpanType.MODEL_STEP) {
      if (attrs.stepIndex !== undefined) out[`${prefix}step_index`] = attrs.stepIndex;
      if (attrs.isContinued !== undefined) out[`${prefix}is_continued`] = attrs.isContinued;
    }
    if (span.type === SpanType.RAG_EMBEDDING) {
      if (attrs.mode) out[`${prefix}mode`] = attrs.mode;
      if (attrs.dimensions !== undefined) out[`${prefix}dimensions`] = attrs.dimensions;
      if (attrs.inputCount !== undefined) out[`${prefix}input_count`] = attrs.inputCount;
      // Test-only key that collides with the existing operationName metadata.
      if (attrs.operationName !== undefined) out[`${prefix}operation_name`] = attrs.operationName;
    }
    return out;
  }

  class MockSpanConverter {
    constructor(params: any) {
      converterConstructorArgs.push(params);
    }
    convertSpan = vi.fn().mockImplementation((span: any) => ({
      name: span.name,
      attributes: {
        'gen_ai.request.model': span.attributes?.model,
        'gen_ai.provider.name': span.attributes?.provider,
        'gen_ai.usage.input_tokens': span.attributes?.usage?.inputTokens,
        'gen_ai.usage.output_tokens': span.attributes?.usage?.outputTokens,
        ...(span.attributes?.usage?.outputDetails?.reasoning !== undefined
          ? { 'gen_ai.usage.reasoning_tokens': span.attributes.usage.outputDetails.reasoning }
          : {}),
        'mastra.span.type': span.type,
        ...(span.metadata
          ? Object.fromEntries(Object.entries(span.metadata).map(([k, v]) => [`mastra.metadata.${k}`, v]))
          : {}),
        ...(span.isRootSpan && span.tags?.length ? { 'mastra.tags': JSON.stringify(span.tags) } : {}),
        ...(span.errorInfo ? { 'error.type': span.errorInfo.id, 'error.message': span.errorInfo.message } : {}),
        ...(span.attributes?.completionStartTime
          ? { 'mastra.completion_start_time': span.attributes.completionStartTime.toISOString() }
          : {}),
        ...ioAttributes(span, 'input'),
        ...ioAttributes(span, 'output'),
        ...spanTypeAttributes(span),
        // Pass through entityId/entityName as gen_ai.agent.* (mirrors real SpanConverter behavior)
        ...(span.entityId ? { 'gen_ai.agent.id': span.entityId } : {}),
        ...(span.entityName ? { 'gen_ai.agent.name': span.entityName } : {}),
        ...(span.operationName ? { 'gen_ai.operation.name': span.operationName } : {}),
      },
      spanContext: () => ({ traceId: span.traceId, spanId: span.id }),
    }));
  }
  return { SpanConverter: MockSpanConverter };
});

function makeSpan(overrides: Partial<Mutable<AnyExportedSpan>> = {}): AnyExportedSpan {
  return {
    id: 'span-1',
    traceId: 'trace-1',
    type: SpanType.MODEL_GENERATION,
    name: 'Test Span',
    startTime: new Date('2025-01-01T00:00:00Z'),
    endTime: new Date('2025-01-01T00:00:01Z'),
    input: { messages: [{ role: 'user', content: 'Hello' }] },
    output: { text: 'Hi there' },
    attributes: {
      model: 'gpt-4o',
      provider: 'openai',
      usage: { inputTokens: 10, outputTokens: 5 },
    },
    ...overrides,
  } as unknown as AnyExportedSpan;
}

async function exportSpan(exporter: LangfuseExporter, span: AnyExportedSpan) {
  await exporter.exportTracingEvent({
    type: TracingEventType.SPAN_ENDED,
    exportedSpan: span,
  });
}

describe('LangfuseExporter', () => {
  let exporter: LangfuseExporter | undefined;

  beforeEach(() => {
    processedSpans.length = 0;
    processorConstructorArgs.length = 0;
    converterConstructorArgs.length = 0;
    clientConstructorArgs.length = 0;
    mockScoreCreate.mockClear();
    mockForceFlush.mockClear();
    mockShutdown.mockClear();
    mockClientFlush.mockClear();
    mockClientShutdown.mockClear();
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_BASE_URL;
    delete process.env.LANGFUSE_TRACING_ENVIRONMENT;
    delete process.env.LANGFUSE_RELEASE;
  });

  afterEach(async () => {
    if (exporter) {
      await exporter.shutdown();
      exporter = undefined;
    }

    if (originalLangfuseEnv.publicKey === undefined) delete process.env.LANGFUSE_PUBLIC_KEY;
    else process.env.LANGFUSE_PUBLIC_KEY = originalLangfuseEnv.publicKey;
    if (originalLangfuseEnv.secretKey === undefined) delete process.env.LANGFUSE_SECRET_KEY;
    else process.env.LANGFUSE_SECRET_KEY = originalLangfuseEnv.secretKey;
    if (originalLangfuseEnv.baseUrl === undefined) delete process.env.LANGFUSE_BASE_URL;
    else process.env.LANGFUSE_BASE_URL = originalLangfuseEnv.baseUrl;
    if (originalLangfuseEnv.environment === undefined) delete process.env.LANGFUSE_TRACING_ENVIRONMENT;
    else process.env.LANGFUSE_TRACING_ENVIRONMENT = originalLangfuseEnv.environment;
    if (originalLangfuseEnv.release === undefined) delete process.env.LANGFUSE_RELEASE;
    else process.env.LANGFUSE_RELEASE = originalLangfuseEnv.release;
  });

  describe('configuration', () => {
    it('disables when publicKey is missing', () => {
      exporter = new LangfuseExporter({ secretKey: 'sk-test' });
      expect(exporter.isDisabled).toBe(true);
    });

    it('disables when secretKey is missing', () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test' });
      expect(exporter.isDisabled).toBe(true);
    });

    it('disables when both keys are missing', () => {
      exporter = new LangfuseExporter();
      expect(exporter.isDisabled).toBe(true);
    });

    it('enables when both keys are provided', () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      expect(exporter.isDisabled).toBe(false);
    });

    it('reads credentials from environment variables', () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-env';
      process.env.LANGFUSE_SECRET_KEY = 'sk-env';
      try {
        exporter = new LangfuseExporter();
        expect(exporter.isDisabled).toBe(false);
      } finally {
        delete process.env.LANGFUSE_PUBLIC_KEY;
        delete process.env.LANGFUSE_SECRET_KEY;
      }
    });

    it('creates LangfuseSpanProcessor with correct config', () => {
      exporter = new LangfuseExporter({
        publicKey: 'pk-test',
        secretKey: 'sk-test',
        baseUrl: 'https://custom.langfuse.com',
        additionalHeaders: {
          'x-custom-header': 'custom-value',
        },
        environment: 'production',
        release: '1.0.0',
      });

      expect(processorConstructorArgs[0]).toEqual(
        expect.objectContaining({
          publicKey: 'pk-test',
          secretKey: 'sk-test',
          baseUrl: 'https://custom.langfuse.com',
          additionalHeaders: {
            'x-custom-header': 'custom-value',
          },
          environment: 'production',
          release: '1.0.0',
          exportMode: 'batched',
        }),
      );
    });

    it('passes resource attributes to the span converter after init', async () => {
      exporter = new LangfuseExporter({
        publicKey: 'pk-test',
        secretKey: 'sk-test',
        resourceAttributes: { 'service.version': 'my-app-2.3.1' },
      });
      exporter.init({ config: { serviceName: 'my-app' } } as any);
      await exportSpan(exporter, makeSpan());

      expect(converterConstructorArgs[0]).toEqual(
        expect.objectContaining({
          serviceName: 'my-app',
          config: { resourceAttributes: { 'service.version': 'my-app-2.3.1' } },
        }),
      );
    });

    it('passes resource attributes to the standalone span converter', async () => {
      exporter = new LangfuseExporter({
        publicKey: 'pk-test',
        secretKey: 'sk-test',
        resourceAttributes: { 'service.version': 'my-app-2.3.1' },
      });
      await exportSpan(exporter, makeSpan());

      expect(converterConstructorArgs[0].config.resourceAttributes).toEqual({ 'service.version': 'my-app-2.3.1' });
    });

    it('uses immediate export mode when realtime is true', () => {
      exporter = new LangfuseExporter({
        publicKey: 'pk-test',
        secretKey: 'sk-test',
        realtime: true,
      });

      expect(processorConstructorArgs[0]).toEqual(
        expect.objectContaining({
          exportMode: 'immediate',
        }),
      );
    });

    it('passes batch controls to LangfuseSpanProcessor', () => {
      exporter = new LangfuseExporter({
        publicKey: 'pk-test',
        secretKey: 'sk-test',
        flushAt: 200,
        flushInterval: 15,
      });

      expect(processorConstructorArgs[0]).toEqual(
        expect.objectContaining({
          flushAt: 200,
          flushInterval: 15,
        }),
      );
    });

    it('creates LangfuseClient with correct config', () => {
      exporter = new LangfuseExporter({
        publicKey: 'pk-test',
        secretKey: 'sk-test',
        baseUrl: 'https://custom.langfuse.com',
        additionalHeaders: {
          'x-custom-header': 'custom-value',
        },
      });

      expect(clientConstructorArgs[0]).toEqual(
        expect.objectContaining({
          publicKey: 'pk-test',
          secretKey: 'sk-test',
          baseUrl: 'https://custom.langfuse.com',
          additionalHeaders: {
            'x-custom-header': 'custom-value',
          },
        }),
      );
    });
  });

  describe('span export', () => {
    it('converts and forwards spans to LangfuseSpanProcessor', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(exporter, makeSpan());

      expect(processedSpans.length).toBe(1);
      expect(processedSpans[0].attributes['gen_ai.request.model']).toBe('gpt-4o');
    });

    it('does not export spans when disabled', async () => {
      exporter = new LangfuseExporter();
      await exportSpan(exporter, makeSpan());
      expect(processedSpans.length).toBe(0);
    });

    it('only processes SPAN_ENDED events', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: makeSpan(),
      } as any);
      expect(processedSpans.length).toBe(0);
    });

    it('uses serviceName from init() when available', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      exporter.init({ config: { serviceName: 'my-custom-service' } } as any);
      await exportSpan(exporter, makeSpan());
      expect(processedSpans.length).toBe(1);
    });

    it('handles span conversion errors gracefully', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      exporter.init({ config: {} } as any);

      // Override convertSpan to throw
      const converter = (exporter as any)['#spanConverter'] ?? {};
      if (converter.convertSpan) {
        converter.convertSpan.mockRejectedValueOnce(new Error('Conversion failed'));
      }

      // Should not throw
      await expect(exportSpan(exporter, makeSpan())).resolves.toBeUndefined();
    });

    it('maps prompt metadata to langfuse.observation.prompt.* attributes', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          metadata: {
            langfuse: { prompt: { name: 'customer-support', version: 2 } },
          },
        }),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.observation.prompt.name']).toBe('customer-support');
      expect(attrs['langfuse.observation.prompt.version']).toBe(2);
      expect(attrs['mastra.metadata.langfuse']).toBeUndefined();
    });

    it('forwards custom mastra.metadata.langfuse.* keys to langfuse.trace.metadata.*', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          metadata: {
            langfuse: {
              prompt: { name: 'customer-support', version: 2 },
              customerId: 'abc',
              tier: 'enterprise',
              seats: 42,
              isVip: true,
              nested: { plan: 'pro' },
            },
          },
        }),
      );

      const attrs = processedSpans[0].attributes;
      // prompt linking still works
      expect(attrs['langfuse.observation.prompt.name']).toBe('customer-support');
      expect(attrs['langfuse.observation.prompt.version']).toBe(2);
      // custom top-level keys are forwarded as filterable trace metadata
      expect(attrs['langfuse.trace.metadata.customerId']).toBe('abc');
      expect(attrs['langfuse.trace.metadata.tier']).toBe('enterprise');
      // Langfuse maps trace.metadata.* as string attributes, so numbers,
      // booleans, and objects are serialized with JSON before export
      // (Langfuse restores their original types on ingestion).
      expect(attrs['langfuse.trace.metadata.seats']).toBe('42');
      expect(attrs['langfuse.trace.metadata.isVip']).toBe('true');
      expect(attrs['langfuse.trace.metadata.nested']).toBe(JSON.stringify({ plan: 'pro' }));
      // the prompt key itself is not forwarded as trace metadata
      expect(attrs['langfuse.trace.metadata.prompt']).toBeUndefined();
      expect(attrs['mastra.metadata.langfuse']).toBeUndefined();
    });

    it('forwards custom langfuse metadata even when no prompt is present', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          metadata: {
            langfuse: { customerId: 'abc' },
          },
        }),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.metadata.customerId']).toBe('abc');
      expect(attrs['langfuse.observation.prompt.name']).toBeUndefined();
      expect(attrs['mastra.metadata.langfuse']).toBeUndefined();
    });

    it('lets reserved root-span identity keys take precedence over custom langfuse metadata', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          type: SpanType.AGENT_RUN,
          isRootSpan: true,
          entityId: 'weather-agent',
          entityName: 'Weather Agent',
          metadata: {
            langfuse: { agentId: 'user-supplied', customerId: 'abc' },
          },
        }),
      );

      const attrs = processedSpans[0].attributes;
      // root-span identity wins over a user-supplied collision
      expect(attrs['langfuse.trace.metadata.agentId']).toBe('weather-agent');
      // non-colliding custom keys are still forwarded
      expect(attrs['langfuse.trace.metadata.customerId']).toBe('abc');
    });

    it('maps completionStartTime to langfuse.observation.completion_start_time', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      const ttftTime = new Date('2025-01-01T00:00:00.500Z');
      await exportSpan(
        exporter,
        makeSpan({
          attributes: {
            model: 'gpt-4o',
            provider: 'openai',
            completionStartTime: ttftTime,
            usage: { inputTokens: 10, outputTokens: 5 },
          },
        }),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.observation.completion_start_time']).toBe(ttftTime.toISOString());
      expect(attrs['mastra.completion_start_time']).toBeUndefined();
    });

    it.each([
      {
        name: 'maps a provider-reported USD total',
        source: 'provider_reported',
        cost: 0.0123,
        expected: JSON.stringify({ total: 0.0123 }),
      },
      {
        name: 'does not map a registry estimate',
        source: 'pricing_registry',
        cost: 0.0099,
        expected: undefined,
      },
    ])('$name', async ({ source, cost, expected }) => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          attributes: {
            model: 'anthropic/claude-sonnet-4',
            provider: 'openrouter',
            usage: { inputTokens: 10, outputTokens: 5 },
            costContext: {
              provider: 'openrouter',
              estimatedCost: cost,
              costUnit: 'USD',
              costMetadata: { source, providerCostFields: ['usage.cost'] },
            },
          },
        }),
      );

      expect(processedSpans[0].attributes['langfuse.observation.cost_details']).toBe(expected);
    });

    it('maps userId to user.id', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(exporter, makeSpan({ metadata: { userId: 'user-123' } }));

      const attrs = processedSpans[0].attributes;
      expect(attrs['user.id']).toBe('user-123');
      expect(attrs['mastra.metadata.userId']).toBeUndefined();
    });

    it('maps sessionId to session.id', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(exporter, makeSpan({ metadata: { sessionId: 'session-456' } }));

      const attrs = processedSpans[0].attributes;
      expect(attrs['session.id']).toBe('session-456');
      expect(attrs['mastra.metadata.sessionId']).toBeUndefined();
    });

    it('moves mastra.*.input/output to langfuse.observation.input/output', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          type: SpanType.WORKFLOW_STEP,
          input: { text: 'Hello' },
          output: { text: 'Hi there' },
          attributes: {},
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.observation.input']).toBe(JSON.stringify({ text: 'Hello' }));
      expect(attrs['langfuse.observation.output']).toBe(JSON.stringify({ text: 'Hi there' }));
      expect(attrs['mastra.workflow_step.input']).toBeUndefined();
      expect(attrs['mastra.workflow_step.output']).toBeUndefined();
    });

    it('leaves gen_ai input/output untouched for model generation spans', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(exporter, makeSpan({ input: { text: 'Hello' }, output: { text: 'Hi there' } }));

      const attrs = processedSpans[0].attributes;
      expect(attrs['gen_ai.input.messages']).toBe(JSON.stringify({ text: 'Hello' }));
      expect(attrs['gen_ai.output.messages']).toBe(JSON.stringify({ text: 'Hi there' }));
      expect(attrs['langfuse.observation.input']).toBeUndefined();
      expect(attrs['langfuse.observation.output']).toBeUndefined();
    });

    it('uses the Langfuse semconv key for inclusive reasoning usage', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          attributes: {
            model: 'gpt-6-luna',
            provider: 'azure.openai.responses',
            usage: { inputTokens: 39_056, outputTokens: 2_023, outputDetails: { reasoning: 1_632 } },
          },
        }),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['gen_ai.usage.output_tokens']).toBe(2_023);
      expect(attrs['gen_ai.usage.reasoning.output_tokens']).toBe(1_632);
      expect(attrs['gen_ai.usage.reasoning_tokens']).toBeUndefined();
    });

    it('maps root-span input/output to langfuse.trace.input/output', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          isRootSpan: true,
          type: SpanType.AGENT_RUN,
          input: { parts: [{ type: 'text', text: 'Hello' }] },
          output: { text: 'Hi there' },
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.input']).toBe(JSON.stringify({ parts: [{ type: 'text', text: 'Hello' }] }));
      expect(attrs['langfuse.trace.output']).toBe(JSON.stringify({ text: 'Hi there' }));
    });

    it('passes string root-span input/output through without re-serializing', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({ isRootSpan: true, input: 'plain question', output: 'plain answer' } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.input']).toBe('plain question');
      expect(attrs['langfuse.trace.output']).toBe('plain answer');
    });

    it('does not set trace input/output for non-root spans', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(exporter, makeSpan({ isRootSpan: false } as any));

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.input']).toBeUndefined();
      expect(attrs['langfuse.trace.output']).toBeUndefined();
    });

    it('keeps the original user message as trace input after a tool-approval resume', async () => {
      // A resumed AGENT_RUN rejoins the suspended run's trace with
      // parentSpanId === metadata.resumedFromSpanId. Its input is the approval
      // payload; writing it as langfuse.trace.input would replace the user's
      // message (last writer wins in Langfuse). Trace output is the final reply
      // and must still be written. (#23704)
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          isRootSpan: true,
          type: SpanType.AGENT_RUN,
          parentSpanId: 'suspended-run',
          metadata: { runId: 'run-1', resumed: true, resumedFromSpanId: 'suspended-run' },
          input: { approved: true, toolName: 'navigateTool', toolCallId: 'call-1' },
          output: { text: 'Opening the dashboard.' },
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.input']).toBeUndefined();
      expect(attrs['langfuse.trace.output']).toBe(JSON.stringify({ text: 'Opening the dashboard.' }));
    });

    it('writes trace input for a resume that starts a new trace', async () => {
      // Caller passed a fresh traceId on resume: core leaves parentSpanId
      // empty, so this run is a genuine root and owns its trace input.
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          isRootSpan: true,
          type: SpanType.AGENT_RUN,
          metadata: { runId: 'run-1', resumed: true, resumedFromSpanId: 'suspended-run' },
          input: { approved: true, toolName: 'navigateTool', toolCallId: 'call-1' },
          output: { text: 'Opening the dashboard.' },
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.input']).toBe(
        JSON.stringify({ approved: true, toolName: 'navigateTool', toolCallId: 'call-1' }),
      );
    });

    it('does not write trace-level fields for a run nested under an existing span', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          isRootSpan: true,
          nestedUnderParent: true,
          externalParentSpanId: 'turn-span',
          type: SpanType.AGENT_RUN,
          entityId: 'judge',
          entityName: 'Judge',
          input: 'Grade the answer',
          output: { text: '{"score":1}' },
          metadata: {
            runId: 'judge-run',
            userId: 'judge-user',
            sessionId: 'judge-session',
            traceName: 'Judge trace',
            langfuse: { tenant: 'acme', prompt: { name: 'judge-prompt', version: 2 } },
          },
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      const traceLevelKeys = Object.keys(attrs).filter(
        key => key.startsWith('langfuse.trace.') || key === 'user.id' || key === 'session.id',
      );
      expect(traceLevelKeys).toEqual([]);
      // Observation-level data still goes out
      expect(attrs['langfuse.observation.input']).toBe('Grade the answer');
      expect(attrs['langfuse.observation.prompt.name']).toBe('judge-prompt');
      expect(attrs['mastra.metadata.userId']).toBe('judge-user');
    });

    it('does not write trace-level fields for child spans of a nested run', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          isRootSpan: false,
          nestedUnderParent: true,
          metadata: { userId: 'judge-user', threadId: 'judge-thread', traceName: 'Judge trace' },
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['user.id']).toBeUndefined();
      expect(attrs['session.id']).toBeUndefined();
      expect(attrs['langfuse.trace.name']).toBeUndefined();
    });

    it('keeps trace-level fields for a root with a parent span id that is not nested', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          isRootSpan: true,
          externalParentSpanId: 'http-span',
          type: SpanType.AGENT_RUN,
          entityId: 'assistant',
          input: 'When does my order ship?',
          output: { text: 'Friday' },
          metadata: { userId: 'user-1' },
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.name']).toBe('assistant');
      expect(attrs['langfuse.trace.input']).toBe('When does my order ship?');
      expect(attrs['langfuse.trace.output']).toBe(JSON.stringify({ text: 'Friday' }));
      expect(attrs['user.id']).toBe('user-1');
    });

    it('omits trace input/output that cannot be serialized instead of failing the export', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      await exportSpan(exporter, makeSpan({ isRootSpan: true, input: circular, output: { text: 'ok' } } as any));

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.input']).toBeUndefined();
      expect(attrs['langfuse.trace.output']).toBe(JSON.stringify({ text: 'ok' }));
    });

    it('omits trace input/output when the root span has none', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(exporter, makeSpan({ isRootSpan: true, input: undefined, output: undefined } as any));

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.input']).toBeUndefined();
      expect(attrs['langfuse.trace.output']).toBeUndefined();
    });

    it('maps tags to langfuse.trace.tags', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(exporter, makeSpan({ isRootSpan: true, tags: ['prod', 'v2'] } as any));

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.tags']).toBe(JSON.stringify(['prod', 'v2']));
      expect(attrs['mastra.tags']).toBeUndefined();
    });

    it('maps traceName metadata to langfuse.trace.name', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(exporter, makeSpan({ metadata: { traceName: 'Weather Agent Run' } }));

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.name']).toBe('Weather Agent Run');
      expect(attrs['mastra.metadata.traceName']).toBeUndefined();
    });

    it('maps version metadata to langfuse.version', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(exporter, makeSpan({ metadata: { version: '2.1.0' } }));

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.version']).toBe('2.1.0');
      expect(attrs['mastra.metadata.version']).toBeUndefined();
    });

    it('maps gen_ai.agent.id to langfuse.observation.metadata.agentId', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          entityId: 'weather-agent',
          entityName: 'Weather Agent',
          operationName: 'chat',
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.observation.metadata.agentId']).toBe('weather-agent');
      expect(attrs['langfuse.observation.metadata.agentName']).toBe('Weather Agent');
      expect(attrs['langfuse.observation.metadata.operationName']).toBe('chat');
      // Original attributes should still be present (not deleted)
      expect(attrs['gen_ai.agent.id']).toBe('weather-agent');
    });

    it('maps mastra.span.type to langfuse.observation.metadata.spanType', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(exporter, makeSpan({ type: SpanType.MODEL_GENERATION }));

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.observation.metadata.spanType']).toBe(SpanType.MODEL_GENERATION);
    });

    it('promotes span-type attributes to camelCase observation metadata', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          type: SpanType.MODEL_STEP,
          input: [{ role: 'user', content: 'Hello' }],
          output: { text: 'Hi', toolCalls: [] },
          attributes: { stepIndex: 1, isContinued: false },
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.observation.metadata.stepIndex']).toBe('1');
      expect(attrs['langfuse.observation.metadata.isContinued']).toBe('false');
      // Source attributes stay in place; input/output keep their own mapping.
      expect(attrs['mastra.model_step.step_index']).toBe(1);
      expect(attrs['mastra.model_step.is_continued']).toBe(false);
      expect(attrs['langfuse.observation.metadata.input']).toBeUndefined();
      expect(attrs['langfuse.observation.metadata.output']).toBeUndefined();
      expect(attrs['langfuse.observation.input']).toBeDefined();
    });

    it('keeps existing observation metadata when a promoted key collides', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          type: SpanType.RAG_EMBEDDING,
          operationName: 'embed',
          attributes: {
            model: 'text-embedding-3-small',
            mode: 'batch',
            dimensions: 1536,
            inputCount: 3,
            operationName: 'collision',
          },
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.observation.metadata.mode']).toBe('batch');
      expect(attrs['langfuse.observation.metadata.dimensions']).toBe('1536');
      expect(attrs['langfuse.observation.metadata.inputCount']).toBe('3');
      expect(attrs['langfuse.observation.metadata.spanType']).toBe(SpanType.RAG_EMBEDDING);
      // gen_ai.operation.name wins over the colliding mastra.rag_embedding.operation_name.
      expect(attrs['mastra.rag_embedding.operation_name']).toBe('collision');
      expect(attrs['langfuse.observation.metadata.operationName']).toBe('embed');
    });

    it('does not set observation metadata when source attributes are absent', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      // Create a span with no type, entityId, entityName, or operationName
      await exportSpan(
        exporter,
        makeSpan({
          type: undefined as any,
          entityId: undefined,
          entityName: undefined,
          operationName: undefined,
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.observation.metadata.agentId']).toBeUndefined();
      expect(attrs['langfuse.observation.metadata.agentName']).toBeUndefined();
      expect(attrs['langfuse.observation.metadata.spanType']).toBeUndefined();
      expect(attrs['langfuse.observation.metadata.operationName']).toBeUndefined();
    });

    it('scopes trace name and metadata to the agent on root AGENT_RUN spans', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          type: SpanType.AGENT_RUN,
          isRootSpan: true,
          entityId: 'weather-agent',
          entityName: 'Weather Agent',
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.name']).toBe('Weather Agent');
      expect(attrs['langfuse.trace.metadata.agentId']).toBe('weather-agent');
      expect(attrs['langfuse.trace.metadata.agentName']).toBe('Weather Agent');
    });

    it('falls back to entityId for trace name when entityName is missing', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          type: SpanType.AGENT_RUN,
          isRootSpan: true,
          entityId: 'weather-agent',
          entityName: undefined,
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.name']).toBe('weather-agent');
      expect(attrs['langfuse.trace.metadata.agentId']).toBe('weather-agent');
      expect(attrs['langfuse.trace.metadata.agentName']).toBeUndefined();
    });

    it('preserves user-provided traceName over the agent default', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          type: SpanType.AGENT_RUN,
          isRootSpan: true,
          entityId: 'weather-agent',
          entityName: 'Weather Agent',
          metadata: { traceName: 'custom-trace-name' },
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.name']).toBe('custom-trace-name');
      expect(attrs['langfuse.trace.metadata.agentId']).toBe('weather-agent');
      expect(attrs['langfuse.trace.metadata.agentName']).toBe('Weather Agent');
    });

    it('does not set trace identity on non-root agent spans', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          type: SpanType.AGENT_RUN,
          isRootSpan: false,
          entityId: 'weather-agent',
          entityName: 'Weather Agent',
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.name']).toBeUndefined();
      expect(attrs['langfuse.trace.metadata.agentId']).toBeUndefined();
      expect(attrs['langfuse.trace.metadata.agentName']).toBeUndefined();
    });

    it('forwards remaining root span metadata to langfuse.trace.metadata.*', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          type: SpanType.AGENT_RUN,
          isRootSpan: true,
          entityId: 'weather-agent',
          metadata: {
            runId: 'run-1',
            resourceId: 'user-42',
            sampleKey: 'sample-value',
            attempt: 3,
            flags: { beta: true },
            skipped: null,
          },
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.metadata.runId']).toBe('run-1');
      expect(attrs['langfuse.trace.metadata.resourceId']).toBe('user-42');
      expect(attrs['langfuse.trace.metadata.sampleKey']).toBe('sample-value');
      // non-strings are JSON-serialized, matching the metadata.langfuse.* path
      expect(attrs['langfuse.trace.metadata.attempt']).toBe('3');
      expect(attrs['langfuse.trace.metadata.flags']).toBe(JSON.stringify({ beta: true }));
      expect(attrs['langfuse.trace.metadata.skipped']).toBeUndefined();
      // identity keys are still set alongside the forwarded metadata
      expect(attrs['langfuse.trace.metadata.agentId']).toBe('weather-agent');
      // the mastra.metadata.* attributes stay on the observation
      expect(attrs['mastra.metadata.runId']).toBe('run-1');
      expect(attrs['mastra.metadata.sampleKey']).toBe('sample-value');
    });

    it('does not forward metadata from non-root spans to trace metadata', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          type: SpanType.TOOL_CALL,
          isRootSpan: false,
          metadata: { runId: 'run-child', sampleKey: 'child-value' },
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.metadata.runId']).toBeUndefined();
      expect(attrs['langfuse.trace.metadata.sampleKey']).toBeUndefined();
      expect(attrs['mastra.metadata.runId']).toBe('run-child');
    });

    it('does not duplicate root metadata keys that map to dedicated Langfuse fields', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          type: SpanType.AGENT_RUN,
          isRootSpan: true,
          entityId: 'weather-agent',
          metadata: {
            userId: 'user-123',
            threadId: 'thread-1',
            traceName: 'custom-trace-name',
            version: '2.1.0',
            runId: 'run-1',
          },
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['user.id']).toBe('user-123');
      expect(attrs['session.id']).toBe('thread-1');
      expect(attrs['langfuse.trace.name']).toBe('custom-trace-name');
      expect(attrs['langfuse.version']).toBe('2.1.0');
      expect(attrs['langfuse.trace.metadata.userId']).toBeUndefined();
      expect(attrs['langfuse.trace.metadata.threadId']).toBeUndefined();
      expect(attrs['langfuse.trace.metadata.sessionId']).toBeUndefined();
      expect(attrs['langfuse.trace.metadata.traceName']).toBeUndefined();
      expect(attrs['langfuse.trace.metadata.version']).toBeUndefined();
      expect(attrs['langfuse.trace.metadata.runId']).toBe('run-1');
    });

    it('does not forward dedicated metadata keys with falsy values', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          type: SpanType.AGENT_RUN,
          isRootSpan: true,
          entityId: 'weather-agent',
          metadata: {
            userId: '',
            sessionId: '',
            threadId: '',
            traceName: '',
            version: 0,
            langfuse: '',
            runId: 'run-1',
          },
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.metadata.userId']).toBeUndefined();
      expect(attrs['langfuse.trace.metadata.sessionId']).toBeUndefined();
      expect(attrs['langfuse.trace.metadata.threadId']).toBeUndefined();
      expect(attrs['langfuse.trace.metadata.traceName']).toBeUndefined();
      expect(attrs['langfuse.trace.metadata.version']).toBeUndefined();
      expect(attrs['langfuse.trace.metadata.langfuse']).toBeUndefined();
      expect(attrs['langfuse.trace.metadata.runId']).toBe('run-1');
    });

    it('lets explicit metadata.langfuse.* values take precedence over root span metadata', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          type: SpanType.AGENT_RUN,
          isRootSpan: true,
          entityId: 'weather-agent',
          metadata: {
            tier: 'root-value',
            langfuse: { tier: 'explicit-value' },
          },
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.metadata.tier']).toBe('explicit-value');
      expect(attrs['langfuse.trace.metadata.langfuse']).toBeUndefined();
    });

    it('scopes trace name and metadata to the workflow on root WORKFLOW_RUN spans', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(
        exporter,
        makeSpan({
          type: SpanType.WORKFLOW_RUN,
          isRootSpan: true,
          entityId: 'order-workflow',
          entityName: 'Order Workflow',
        } as any),
      );

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.name']).toBe('Order Workflow');
      expect(attrs['langfuse.trace.metadata.workflowId']).toBe('order-workflow');
      expect(attrs['langfuse.trace.metadata.workflowName']).toBe('Order Workflow');
    });

    it('sets langfuse.environment and langfuse.release on spans', async () => {
      exporter = new LangfuseExporter({
        publicKey: 'pk-test',
        secretKey: 'sk-test',
        environment: 'production',
        release: 'v1.2.3',
      });
      await exportSpan(exporter, makeSpan());

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.environment']).toBe('production');
      expect(attrs['langfuse.release']).toBe('v1.2.3');
    });
  });

  describe('client access', () => {
    it('exposes LangfuseClient via client property', () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      expect(exporter.client).toBeDefined();
      expect(exporter.client?.score).toBeDefined();
      expect(exporter.client?.prompt).toBeDefined();
    });

    it('returns undefined client when disabled', () => {
      exporter = new LangfuseExporter();
      expect(exporter.client).toBeUndefined();
    });
  });

  describe('addScoreToTrace (deprecated)', () => {
    it('calls LangfuseClient score.create with correct payload', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });

      await exporter.addScoreToTrace({
        traceId: 'trace-1',
        spanId: 'span-1',
        score: 0.95,
        reason: 'Good response',
        scorerName: 'accuracy',
        metadata: { sessionId: 'session-1' },
      });

      expect(mockScoreCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trace-1-span-1-accuracy',
          traceId: 'trace-1',
          observationId: 'span-1',
          name: 'accuracy',
          value: 0.95,
          comment: 'Good response',
          metadata: { sessionId: 'session-1' },
          dataType: 'NUMERIC',
        }),
      );
    });

    it('does not call score.create when credentials are missing', async () => {
      exporter = new LangfuseExporter();

      await exporter.addScoreToTrace({
        traceId: 'trace-1',
        score: 0.5,
        scorerName: 'test',
      });

      expect(mockScoreCreate).not.toHaveBeenCalled();
    });

    it('handles score.create errors gracefully', async () => {
      mockScoreCreate.mockImplementationOnce(() => {
        throw new Error('Score API error');
      });

      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });

      await expect(
        exporter.addScoreToTrace({
          traceId: 'trace-1',
          score: 0.5,
          scorerName: 'test',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('onScoreEvent', () => {
    const baseScore = {
      scoreId: 'score-xyz',
      timestamp: new Date('2026-01-01T00:00:00Z'),
      traceId: 'trace-1',
      spanId: 'span-1',
      scorerId: 'accuracy',
      scorerName: 'Accuracy Scorer',
      scoreSource: 'live',
      score: 0.95,
      reason: 'Good response',
      metadata: { sessionId: 'session-1' },
    };

    it('forwards a ScoreEvent to LangfuseClient.score.create', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });

      await exporter.onScoreEvent({ type: 'score', score: { ...baseScore } } as any);

      expect(mockScoreCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'score-xyz',
          traceId: 'trace-1',
          observationId: 'span-1',
          name: 'Accuracy Scorer',
          value: 0.95,
          comment: 'Good response',
          metadata: { sessionId: 'session-1' },
          dataType: 'NUMERIC',
        }),
      );
    });

    it('falls back to scorerId when scorerName is missing', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });

      await exporter.onScoreEvent({
        type: 'score',
        score: { ...baseScore, scorerName: undefined },
      } as any);

      expect(mockScoreCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'accuracy' }));
    });

    it('includes the configured environment on the score', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test', environment: 'production' });

      await exporter.onScoreEvent({ type: 'score', score: { ...baseScore } } as any);

      expect(mockScoreCreate).toHaveBeenCalledWith(expect.objectContaining({ environment: 'production' }));
    });

    it('falls back to LANGFUSE_TRACING_ENVIRONMENT when no environment is configured', async () => {
      process.env.LANGFUSE_TRACING_ENVIRONMENT = 'staging';
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });

      await exporter.onScoreEvent({ type: 'score', score: { ...baseScore } } as any);

      expect(mockScoreCreate).toHaveBeenCalledWith(expect.objectContaining({ environment: 'staging' }));
    });

    it('omits environment when none is configured', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });

      await exporter.onScoreEvent({ type: 'score', score: { ...baseScore } } as any);

      expect(mockScoreCreate.mock.calls[0][0]).not.toHaveProperty('environment');
    });

    it('omits the call when traceId is missing', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });

      await exporter.onScoreEvent({
        type: 'score',
        score: { ...baseScore, traceId: undefined },
      } as any);

      expect(mockScoreCreate).not.toHaveBeenCalled();
    });
  });

  describe('flush and shutdown', () => {
    it('flushes both processor and client', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exporter.flush();

      expect(mockForceFlush).toHaveBeenCalled();
      expect(mockClientFlush).toHaveBeenCalled();
    });

    it('shuts down both processor and client', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exporter.shutdown();

      expect(mockShutdown).toHaveBeenCalled();
      expect(mockClientShutdown).toHaveBeenCalled();
    });
  });

  describe('processor configuration', () => {
    it('uses default base URL when none provided', () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });

      expect(processorConstructorArgs[0]).toEqual(
        expect.objectContaining({
          baseUrl: LANGFUSE_DEFAULT_BASE_URL,
        }),
      );
    });

    it('uses custom baseUrl', () => {
      exporter = new LangfuseExporter({
        publicKey: 'pk-test',
        secretKey: 'sk-test',
        baseUrl: 'https://my-langfuse.example.com',
      });

      expect(processorConstructorArgs[0]).toEqual(
        expect.objectContaining({
          baseUrl: 'https://my-langfuse.example.com',
        }),
      );
    });

    it('strips trailing slashes from baseUrl', () => {
      exporter = new LangfuseExporter({
        publicKey: 'pk-test',
        secretKey: 'sk-test',
        baseUrl: 'https://my-langfuse.example.com///',
      });

      expect(processorConstructorArgs[0]).toEqual(
        expect.objectContaining({
          baseUrl: 'https://my-langfuse.example.com',
        }),
      );
    });

    it('reads baseUrl from LANGFUSE_BASE_URL environment variable', () => {
      process.env.LANGFUSE_BASE_URL = 'https://env-langfuse.example.com';
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });

      expect(processorConstructorArgs[0]).toEqual(
        expect.objectContaining({
          baseUrl: 'https://env-langfuse.example.com',
        }),
      );
    });

    it('passes environment and release to processor', () => {
      exporter = new LangfuseExporter({
        publicKey: 'pk-test',
        secretKey: 'sk-test',
        environment: 'staging',
        release: '2.0.0',
      });

      expect(processorConstructorArgs[0]).toEqual(
        expect.objectContaining({
          environment: 'staging',
          release: '2.0.0',
        }),
      );
    });
  });
});
