---
'@mastra/otel-exporter': patch
---

Fixed trace flushing to wait for exports already in flight before returning.
