---
'@mastra/arize': patch
'@mastra/laminar': patch
'@mastra/otel-exporter': patch
---

Raised minimum OpenTelemetry dependency versions so installs always receive `@opentelemetry/resources` 2.12.1 or later, which fixes security advisory GHSA-qrww-3xmv-qhgm. Previously, installs could resolve older `@opentelemetry/sdk-trace-base` or OTLP exporter versions that pin the vulnerable `@opentelemetry/resources` 2.12.0, even with the direct `@opentelemetry/resources` bump.
