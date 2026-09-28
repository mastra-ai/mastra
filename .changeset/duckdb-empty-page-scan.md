---
'@mastra/duckdb': patch
---

Fixed `listTraces`, `listTracesLight`, and `listBranches` scanning the entire `span_events` table when a query matched nothing or requested a page past the end. These calls now return an empty page immediately, so empty filters and out-of-range pages stay fast and use little memory on large stores.
