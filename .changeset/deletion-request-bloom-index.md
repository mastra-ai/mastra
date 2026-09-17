---
'@mastra/clickhouse': patch
---

Added an index on ClickHouse deletion requests so the check that blocks updates to deleted feedback reads fewer rows instead of scanning every deletion request in the tenant scope. Existing deployments pick up the index automatically on the next start; previously written data is covered as it merges.
