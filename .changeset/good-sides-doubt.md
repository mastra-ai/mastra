---
'@mastra/otel-bridge': patch
---

Return `undefined` from `OtelBridge.createSpan` when no OpenTelemetry SDK is registered, so core generates valid span/trace IDs instead of reusing the OTEL no-op all-zero IDs. This prevents downstream trace exporters from dropping spans and stops the infinite-loop CPU spike in parent-matching. Fixes #15589.
