---
'@mastra/otel-bridge': patch
---

Fixed `@mastra/otel-bridge` installing a second copy of `@opentelemetry/api` in npm projects that use the OpenTelemetry SDK 2 packages. That copy cannot read the tracer provider or the active span that your SDK registers. The bridge now accepts `@opentelemetry/api` 1.9, so npm installs one shared copy.
