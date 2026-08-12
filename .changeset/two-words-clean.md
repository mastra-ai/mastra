---
'@mastra/otel-bridge': minor
'@mastra/datadog': minor
---

The OpenTelemetry and Datadog bridges now report whether a created span's parent is a Mastra span or belongs to the external tracing system. Custom bridges should set the new `SpanIds.externalParentSpanId` field for a parent that comes from the external tracing system, so runs started under an external parent are still recorded as trace roots.
