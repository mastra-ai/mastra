---
'@mastra/observability': patch
---

Fixed a race condition where spans were silently dropped when the observability exporter hadn't finished initializing. Exports now wait for initialization to complete before processing.
