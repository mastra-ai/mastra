---
'@mastra/otel-exporter': patch
---

`OtelExporter.flush()` now also waits for span batches that the OpenTelemetry batch processor had already handed to the exporter, so serverless callers that flush and then exit no longer lose those spans. Arize and Arthur exporters inherit the fix.
