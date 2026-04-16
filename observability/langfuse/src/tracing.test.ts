import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LangfuseExporter } from './tracing';

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

// Track calls to LangfuseSpanProcessor
const processedSpans: any[] = [];
const mockForceFlush = vi.fn().mockResolvedValue(undefined);
const mockShutdown = vi.fn().mockResolvedValue(undefined);
const processorConstructorArgs: any[] = [];

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
  class MockSpanConverter {
    convertSpan = vi.fn().mockImplementation((span: any) => ({
      name: span.name,
      attributes: {
        'gen_ai.request.model': span.attributes?.model,
        'gen_ai.provider.name': span.attributes?.provider,
        'gen_ai.usage.input_tokens': span.attributes?.usage?.inputTokens,
        'gen_ai.usage.output_tokens': span.attributes?.usage?.outputTokens,
        'mastra.span.type': span.type,
        ...(span.metadata
          ? Object.fromEntries(Object.entries(span.metadata).map(([k, v]) => [`mastra.metadata.${k}`, v]))
          : {}),
        ...(span.isRootSpan && span.tags?.length ? { 'mastra.tags': JSON.stringify(span.tags) } : {}),
        ...(span.errorInfo ? { 'error.type': span.errorInfo.id, 'error.message': span.errorInfo.message } : {}),
        ...(span.attributes?.completionStartTime
          ? { 'mastra.completion_start_time': span.attributes.completionStartTime.toISOString() }
          : {}),
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
    clientConstructorArgs.length = 0;
    mockScoreCreate.mockClear();
    mockForceFlush.mockClear();
    mockShutdown.mockClear();
    mockClientFlush.mockClear();
    mockClientShutdown.mockClear();
  });

  afterEach(async () => {
    if (exporter) {
      await exporter.shutdown();
      exporter = undefined;
    }
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
        environment: 'production',
        release: '1.0.0',
      });

      expect(processorConstructorArgs[0]).toEqual(
        expect.objectContaining({
          publicKey: 'pk-test',
          secretKey: 'sk-test',
          baseUrl: 'https://custom.langfuse.com',
          environment: 'production',
          release: '1.0.0',
          exportMode: 'batched',
        }),
      );
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

    it('creates LangfuseClient with correct config', () => {
      exporter = new LangfuseExporter({
        publicKey: 'pk-test',
        secretKey: 'sk-test',
        baseUrl: 'https://custom.langfuse.com',
      });

      expect(clientConstructorArgs[0]).toEqual(
        expect.objectContaining({
          publicKey: 'pk-test',
          secretKey: 'sk-test',
          baseUrl: 'https://custom.langfuse.com',
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

    it('maps tags to langfuse.trace.tags', async () => {
      exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
      await exportSpan(exporter, makeSpan({ isRootSpan: true, tags: ['prod', 'v2'] } as any));

      const attrs = processedSpans[0].attributes;
      expect(attrs['langfuse.trace.tags']).toBe(JSON.stringify(['prod', 'v2']));
      expect(attrs['mastra.tags']).toBeUndefined();
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

  describe('addScoreToTrace', () => {
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
});
