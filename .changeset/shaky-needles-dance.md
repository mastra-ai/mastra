---
'@mastra/clickhouse': patch
---

Fixed duplicate discovery values returned from the ClickHouse v-next observability discovery endpoints (tags, services, environments, entities, metric names, metric labels). Each refresh of the underlying refreshable materialized views was appending a fresh copy of every distinct value because the target tables used plain MergeTree; values are now collapsed via ReplacingMergeTree and existing deployments are migrated automatically on next startup.
