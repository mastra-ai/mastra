---
"@mastra/core": minor
"@mastra/observability": minor
"@mastra/otel-exporter": minor
---

Added flush method to observability exporters for manual span flushing

Observability exporters now support a `flush()` method that forces immediate export of buffered spans without shutting down the exporter. This is particularly useful in serverless environments where you need to ensure spans are exported before an instance is frozen or reused.

**Usage:**

```typescript
// Force flush spans before returning from a serverless handler
await mastra.observability.flush();

// Or call flush directly on an exporter
const exporter = new OtelExporter(config);
await exporter.flush();

// Unlike shutdown(), the exporter remains operational after flush
await exporter.exportTracingEvent(event); // Still works
```

**Note:** `BaseExporter` provides a default no-op implementation, while `OtelExporter` calls the OpenTelemetry processor's `forceFlush()` to ensure all queued spans are exported immediately.

Closes #11372