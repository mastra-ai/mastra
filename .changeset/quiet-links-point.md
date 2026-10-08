---
'@mastra/core': minor
---

Added `links` to spans: references to spans in other traces. Pass `links` when starting a span to relate it to a span in another trace without joining that trace. Mastra storage saves the links with the span.

```ts
const span = getOrCreateSpan({
  type: SpanType.GENERIC,
  name: 'handle request',
  links: [{ traceId: callerTraceId, spanId: callerSpanId }],
  mastra,
});
```

Also added `parseTraceparent()` and `formatTraceparent()` to `@mastra/core/observability` for W3C `traceparent` values.
