---
'@mastra/arthur': patch
'@mastra/arize': patch
'@mastra/laminar': patch
---

Fixed `import '@mastra/arize'`, `import '@mastra/arthur'`, and `import '@mastra/laminar'` (when installed next to `@mastra/otel-exporter`) failing in ESM projects with "The requested module '@opentelemetry/api' does not provide an export named 'SeverityNumber'". The OpenTelemetry trace exporter dependency now stays on the same OpenTelemetry SDK 2 line as the package's other OpenTelemetry dependencies.
