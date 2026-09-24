---
'@mastra/clickhouse': minor
---

Added ClickHouse support for the `include: { tableSummary: true }` trace-query projection. The store enriches only the selected page with bounded output previews, tags, model, time to first token, error counts, prompt-cache tokens, and the newest feedback and scores without changing trace order, cursors, or totals.
