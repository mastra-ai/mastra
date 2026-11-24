import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import { describe, expect, it } from 'vitest';
import { OtelExporter } from './tracing';

describe('metadataMapping', () => {
  it.each([false, true])('exports metadata with mapping enabled: %s (#28752)', async enabled => {
    const sink = new InMemorySpanExporter();
    const exporter = new OtelExporter({
      provider: { custom: { endpoint: 'http://localhost:4318' } },
      exporter: sink,
      signals: { logs: false },
      metadataMapping: enabled
        ? {
            userId: 'user.id',
            enabled: 'account.enabled',
            missing: 'missing',
            nil: 'nil',
            empty: 'empty',
            details: 'details',
          }
        : undefined,
    });
    try {
      for (const child of [false, true]) {
        const now = new Date();
        await exporter.exportTracingEvent({
          type: TracingEventType.SPAN_ENDED,
          exportedSpan: {
            id: child ? 'a1b2c3d4e5f60719' : 'a1b2c3d4e5f60718',
            traceId: '0af7651916cd43dd8448eb211c80319c',
            parentSpanId: child ? 'a1b2c3d4e5f60718' : undefined,
            type: SpanType.AGENT_RUN,
            name: 'agent run',
            startTime: now,
            endTime: now,
            isRootSpan: !child,
            isEvent: false,
            attributes: {},
            metadata: { userId: 42, enabled: false, nil: null, empty: '', details: { plan: 'pro' } },
          } as AnyExportedSpan,
        });
      }
      await exporter.flush();
      expect(sink.getFinishedSpans()).toHaveLength(2);
      for (const span of sink.getFinishedSpans()) {
        expect(span.attributes).toMatchObject({
          'mastra.metadata.userId': 42,
          'mastra.metadata.enabled': false,
        });
        if (enabled) {
          expect(span.attributes).toMatchObject({
            'user.id': '42',
            'account.enabled': 'false',
            details: '{"plan":"pro"}',
          });
        } else {
          for (const key of ['user.id', 'account.enabled', 'details']) expect(span.attributes[key]).toBeUndefined();
        }
        for (const key of ['missing', 'nil', 'empty']) expect(span.attributes[key]).toBeUndefined();
      }
    } finally {
      await exporter.shutdown();
    }
  });
});
