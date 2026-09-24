---
'@mastra/server': minor
---

`POST /observability/traces/query` accepts `include: { tableSummary: true }` and returns a bounded `tableSummary` on every trace row. Stores without the `trace-query-table-summary` feature return a structured `501`.
