---
'@mastra/clickhouse': minor
---

Added duration ordering for completed span queries. Use `orderBy: [{ field: "durationMs", direction: "desc" }]` to find the slowest spans.
