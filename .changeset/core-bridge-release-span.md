---
'@mastra/core': patch
---

Added an optional `releaseSpan` method to the observability bridge interface.

Bridges hold per-span state from `createSpan()` until the span ends, but span-end events are only delivered for spans that survive export filtering, so a bridge had no way to learn that a filtered span had finished. `releaseSpan(spanId, traceId)` is now called for those spans.

If you maintain a custom bridge, implement it to drop whatever `createSpan()` allocated. Do not end or send the span — it was filtered out on purpose.

```typescript
class MyBridge implements ObservabilityBridge {
  private spans = new Map<string, MySpan>();

  createSpan(options) {
    const span = myTracer.start(options.name);
    this.spans.set(span.id, span);
    return { spanId: span.id, traceId: span.traceId };
  }

  // Called when a span ends but is dropped by excludeSpanTypes,
  // a spanFilter, or a span output processor.
  releaseSpan(spanId: string, _traceId: string) {
    this.spans.delete(spanId);
  }
}
```

The method is optional, so bridges that omit it keep working unchanged.

Fixes [#20368](https://github.com/mastra-ai/mastra/issues/20368).
