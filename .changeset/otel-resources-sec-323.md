---
'@mastra/arize': patch
'@mastra/arthur': patch
'@mastra/laminar': patch
'@mastra/otel-exporter': patch
---

Raised the minimum versions of the OpenTelemetry SDK and OTLP exporter dependencies (`@opentelemetry/sdk-trace-base` and `@opentelemetry/core` `^2.12.1`, OTLP exporters `^0.223.1`) so they no longer resolve to releases that pin `@opentelemetry/resources` 2.12.0, which is affected by security advisory GHSA-qrww-3xmv-qhgm. If your project also depends on OpenTelemetry packages directly, check that they resolve `@opentelemetry/resources` 2.12.1 or later.
