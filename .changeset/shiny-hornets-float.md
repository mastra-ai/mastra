---
'@mastra/otel-exporter': patch
'@mastra/otel-bridge': patch
'@mastra/arize': patch
---

This change adds support for the `tracingOptions.tags` feature to the OpenTelemetry-based exporters and bridge. Tags are now included as span attributes when present on root spans, following the same pattern as Braintrust and Langfuse exporters.

**Changes:**
- **OtelExporter**: Tags are now included as `mastra.tags` span attribute for root spans
- **OtelBridge**: Tags flow through the SpanConverter and are included in native OTEL spans as `mastra.tags`
- **ArizeExporter**: Tags are mapped to the native OpenInference `tag.tags` semantic convention

**Implementation Details:**
- Tags are only included on root spans (by design)
- Tags are stored as JSON-stringified arrays for maximum backend compatibility (many OTEL backends have limited native array support)
- Empty or undefined tag arrays are not included in span attributes

**Usage:**
```typescript
const result = await agent.generate("Hello", {
  tracingOptions: {
    tags: ["production", "experiment-v2"],
  },
});
```

Fixes #10771


