---
'@mastra/observability': patch
---

Fixed a bug in `DefaultExporter` and `MastraStorageExporter` where a transient error during a span-end flush would silently drop span updates that had been deferred earlier in the same flush cycle (e.g. while waiting for their parent span to be created).
