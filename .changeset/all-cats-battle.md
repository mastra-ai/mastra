---
'@mastra/clickhouse': patch
---

Improved trace deletion with a durable deletion request, synchronous purge-clock stamping, and lightweight delete masking across trace branches, metrics, logs, scores, and feedback. A conditional TTL provides a 30-day purge path when ClickHouse hasn't already removed masked rows during a merge.
