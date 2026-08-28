---
'@mastra/clickhouse': patch
---

Added observability feedback and score deletion. Rows are removed from the main events tables with lightweight deletes; rows in the short-lived delta tables aren't touched and expire via TTL within two days.
