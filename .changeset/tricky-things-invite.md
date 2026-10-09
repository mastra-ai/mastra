---
'@mastra/clickhouse': patch
---

Reduced the memory used by `queryTraces()` on large projects. Trace lists, numbered pages, delta polling and thread groups no longer sort every root span payload in the time range, so busy projects that previously hit ClickHouse memory limits now return results. Trace inputs and metadata are now read only for the traces on the returned page.

`queryTraces()` now treats each trace as having one root span. A trace that was written with more than one root span is listed once, under one of its roots, and matches root filters through any of them.
