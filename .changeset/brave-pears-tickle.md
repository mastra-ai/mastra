---
'@mastra/clickhouse': minor
---

Added portable advanced trace-query execution with merge-independent ClickHouse plans and current-row conformance.

ClickHouse observability initialization adds `isPending` columns to span, trace-root, and trace-branch tables so advanced queries can exclude incomplete logical traces. Existing installations are migrated automatically during initialization.
