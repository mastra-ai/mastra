---
'@mastra/clickhouse': patch
---

Fixed duplicate entries in the ClickHouse v-next observability discovery endpoints — tags, services, environments, entities, metric names, and metric labels now return each value once. Existing deployments are reconciled automatically on next startup; no manual migration required.
