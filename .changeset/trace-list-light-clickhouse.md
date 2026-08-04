---
'@mastra/clickhouse': patch
---

Fixed the ClickHouse lightweight trace list: it no longer returns the `input`, `output` and `attributes` payload blobs, it now supports delta polling, and the input preview is derived at read time.

`listTracesLight` now projects only the columns a trace list renders, in both page and delta mode — including the span `metadata` and a computed `status`, so Studio's configurable trace columns keep working. The store reduces `input` to a short `inputPreview` at read time, so the full prompt never leaves the store and the response payload stays flat as prompts grow. There is no schema change and no migration.
