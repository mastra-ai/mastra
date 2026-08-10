---
'@mastra/otel-exporter': patch
---

Fix build break from the @opentelemetry/sdk-logs 0.221 upgrade: BatchLogRecordProcessor now takes a single options object with the exporter inside it, instead of (exporter, options).
