---
'@mastra/observability': patch
---

Fixed `strategy: 'realtime'` on `MastraStorageExporter` in apps with durable execution. It isn't supported there, so the exporter now logs one warning and uses `batch-with-updates`. Existing configs keep working, and single-process apps without durable execution still get `realtime`.
