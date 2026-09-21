---
'@mastra/clickhouse': patch
---

Fixed ClickHouse delta polling returning the same score more than once after a retried or duplicate insert. Each score now gets exactly one delta cursor, and delta reads return one row per score.
