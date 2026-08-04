---
'@mastra/clickhouse': patch
---

Fixed ClickHouse trace listing reading the `input`, `output` and `attributes` blobs for every matching trace.

`listTracesLight` now projects only the columns a trace list renders, in both page and delta mode — including the span `metadata` and a computed `status`, so Studio's configurable trace columns keep working — and spans store a short `inputPreview` alongside `input`. Deriving that preview at read time forced ClickHouse to decompress the whole `input` column, so listing cost scaled with prompt size rather than page size.

Adds an `inputPreview` column to `mastra_span_events`, `mastra_trace_roots` and `mastra_trace_branches`. The migration is additive and runs automatically on `init()`. Spans written before the upgrade keep an empty preview and age out with retention — no backfill is required.
