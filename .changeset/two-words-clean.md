---
'@mastra/otel-bridge': patch
'@mastra/datadog': patch
---

The OpenTelemetry and Datadog bridges now report whether a created span's parent is a Mastra span or lives only in the external tracing system. Custom bridges should adopt the new SpanIds.externalParentSpanId field so externally parented runs keep appearing as trace roots in Mastra Studio.
