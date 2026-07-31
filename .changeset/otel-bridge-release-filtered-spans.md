---
'@mastra/otel-bridge': patch
---

Fixed a memory leak where spans removed by export filtering were never released.

The bridge creates an OpenTelemetry span when a Mastra span starts and frees it when the span ends. Span-end events are only delivered for spans that survive export filtering, so every span dropped by `excludeSpanTypes`, a `spanFilter`, or a span output processor left one entry behind for the life of the process. There was no bound or sweep on it, so long-running services grew steadily.

The filtered spans are still not exported, so what you see in your tracing backend is unchanged.

```typescript
new Observability({
  configs: {
    default: {
      serviceName: 'my-service',
      bridge: new OtelBridge(),
      // Previously leaked one entry per excluded span; now released on span end.
      excludeSpanTypes: [SpanType.MODEL_CHUNK, SpanType.MODEL_STEP],
    },
  },
});
```

Fixes [#20368](https://github.com/mastra-ai/mastra/issues/20368).
