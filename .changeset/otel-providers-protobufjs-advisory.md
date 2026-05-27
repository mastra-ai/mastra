---
'@mastra/arize': minor
'@mastra/laminar': minor
'@mastra/arthur': minor
'@mastra/otel-bridge': minor
---

Bumped the OpenTelemetry dependencies (`@opentelemetry/exporter-trace-otlp-proto`, `@opentelemetry/sdk-logs`, `@opentelemetry/api-logs`) to `^0.218.0`.

This drops the transitive `protobufjs` release flagged by several GitHub advisories that previously appeared on every install, keeping `npm audit` runs and CI audit gates clean. See [#16965](https://github.com/mastra-ai/mastra/issues/16965).
