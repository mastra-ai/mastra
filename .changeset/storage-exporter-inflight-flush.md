---
'@mastra/observability': patch
---

`MastraStorageExporter` and `DefaultExporter` `flush()` and `shutdown()` now wait for storage writes that a batch timer or size trigger already started, so spans are no longer lost when a process exits right after flushing.
