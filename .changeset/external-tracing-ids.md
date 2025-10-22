---
'@mastra/core': patch
---

Add support for external trace and parent span IDs in TracingOptions. This enables integration with external tracing systems by allowing new AI traces to be started with existing traceId and parentSpanId values. The implementation includes OpenTelemetry-compatible ID validation (32 hex chars for trace IDs, 16 hex chars for span IDs).
