---
'@mastra/clickhouse': patch
---

Fixed the Studio Traces page timing out or running out of memory on large ClickHouse datasets. Trace queries now filter trace roots by time window and tenant before deduplicating them, so ClickHouse only reads the requested time range instead of the whole `mastra_trace_roots` table.
