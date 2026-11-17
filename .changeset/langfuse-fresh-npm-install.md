---
'@mastra/langfuse': patch
---

Fixed a crash on import after a fresh `npm install @mastra/langfuse`. npm installed OpenTelemetry exporters that did not match the rest of the package, and the import failed with `The requested module '@opentelemetry/api' does not provide an export named 'SeverityNumber'`.
