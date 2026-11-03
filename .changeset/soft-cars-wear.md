---
'@mastra/arthur': patch
'@mastra/arize': patch
---

Fixed `import '@mastra/arize'` and `import '@mastra/arthur'` failing in ESM projects with "The requested module '@opentelemetry/api' does not provide an export named 'SeverityNumber'". The OpenTelemetry trace exporter dependency now stays on the same OpenTelemetry SDK 2 line as the package's other OpenTelemetry dependencies.
