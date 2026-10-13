---
'@mastra/otel-exporter': patch
---

Fixed `OtelExporter.flush()` so it waits for spans that are still being sent before it returns. Serverless code that flushes and then exits no longer loses those spans. Arize and Arthur exporters get the same fix.
