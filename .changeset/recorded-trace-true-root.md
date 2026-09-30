---
'@mastra/observability': patch
---

Fixed recorded traces choosing the wrong root span when a storage backend returns spans out of start order (for example ClickHouse or DuckDB) and the trace contains a span whose parent was never persisted. Scores and feedback added to these traces now carry the real root's entity and tags.
