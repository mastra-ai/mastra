---
'@mastra/clickhouse': patch
---

Improved ClickHouse feedback update performance after deletions. The check that blocks updates to deleted feedback now uses an index on deletion requests instead of scanning every request in the tenant scope, so latency no longer grows with deletion history. Existing deployments pick up the index automatically on the next start; previously written data is covered as it merges.
