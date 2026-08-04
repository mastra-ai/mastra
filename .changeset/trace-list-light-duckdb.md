---
'@mastra/duckdb': patch
---

Fixed the lightweight trace list on DuckDB ignoring delta polling and leaving the input preview column blank.

`listTracesLight` previously ran a first-page query regardless of `mode`, `after` and `limit`, so a client live-tailing a lightweight list refetched the first page on every poll and never received `delta` or `deltaCursor`. Delta requests now go through the same delta machinery as `listTraces`, with rows projected down to lightweight records.

Page-mode rows now carry an `inputPreview` derived from the stored `input` inside the query — without returning the blob to the caller — and page responses include a `deltaCursor` so polling can switch to delta mode.
