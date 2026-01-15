---
"@mastra/core": minor
"@mastra/observability": minor
"@mastra/otel-exporter": minor
"@mastra/otel-bridge": minor
"@mastra/langfuse": minor
"@mastra/posthog": minor
---

Added flush() method to observability exporters and instances for serverless environments

This feature allows flushing buffered spans without shutting down the exporter, which is useful in serverless environments like Vercel's fluid compute where runtime instances can be reused across multiple requests.

**New API:**

```typescript
// Flush all exporters via the observability instance
const observability = mastra.getObservability();
await observability.flush();

// Or flush individual exporters
const exporters = observability.getExporters();
await exporters[0].flush();
```

**Why this matters:**

In serverless environments, you may need to ensure all spans are exported before the runtime instance is terminated, while keeping the exporter active for future requests. Unlike shutdown(), flush() does not release resources or prevent future exports.

**Affected exporters:**
- DefaultExporter (storage persistence)
- CloudExporter (Mastra Cloud)
- OtelExporter (OpenTelemetry)
- OtelBridge (OpenTelemetry bridge)
- TrackingExporter and its subclasses (Langfuse, LangSmith, Braintrust, PostHog)

Closes #11372
