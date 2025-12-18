---
"@mastra/core": patch
---

Fix memory leak in telemetry decorators when processing large payloads. The `@withSpan` decorator now uses bounded serialization utilities to prevent unbounded memory growth when tracing agents with large inputs like base64 images.
