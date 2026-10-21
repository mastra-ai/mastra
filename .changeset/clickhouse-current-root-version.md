---
'@mastra/clickhouse': patch
---

Fixed ClickHouse trace queries counting or grouping a trace by an outdated copy of its root span. When a run was exported more than once (for example after resuming), `aggregateTraces()` could count the same trace under both `status: error` and `status: success`, and `queryTraces()` could list a trace by a filter that only its older copy matched. Every trace read now uses the root copy that ended last, before applying filters.
