---
'@mastra/otel-bridge': patch
---

OpenTelemetry bridge `flush()` and `shutdown()` now flush the global tracer and logger providers registered by `NodeSDK`, and end leftover spans before flushing.
