---
'@mastra/duckdb': patch
---

Fixed the lightweight trace list on DuckDB ignoring delta polling and leaving the input preview column blank.

`listTracesLight` previously ignored `mode`, `after` and `limit`, so a client live-tailing a lightweight list refetched the first page on every poll and never received `delta` or `deltaCursor`. Delta requests now return only the traces recorded since the cursor, as lightweight rows.

Rows now carry a short `inputPreview` in place of the full input, plus a computed `status` and the span `metadata`, so Studio's configurable trace columns work on the lightweight list. Page responses include a `deltaCursor` so polling can switch to delta mode.

Requires `@mastra/core` >= 1.57.0, which ships the shared `buildInputPreview` and `computeTraceStatus` helpers this store now imports (peer dependency bumped accordingly).
