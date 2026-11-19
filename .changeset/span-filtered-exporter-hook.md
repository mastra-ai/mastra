---
'@mastra/core': patch
---

Added the optional `onSpanFilteredEvent` hook for observability exporters. Mastra calls it when `spanFilter` drops the end of a span whose start was exported. A custom exporter that opens a span on its start event can use it to close that span.

```ts
class MyExporter extends BaseExporter {
  async onSpanFilteredEvent(event: SpanFilteredEvent) {
    this.openSpans.get(event.spanId)?.end(event.endTime);
  }
}
```
