---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/clickhouse': minor
'@mastra/duckdb': minor
---

Added direct feedback lookup to observability storage. `await storage.getFeedbackById(feedbackId)` returns the record or `null` when it is missing.
