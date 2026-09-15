---
'@mastra/clickhouse': patch
---

Add a bloom-filter skip index on `mastra_deletion_requests.predicateValues` so feedback mutation guards no longer scan every deletion request in a tenant scope. Fresh tables get the index from `CREATE TABLE`; existing deployments receive it through the additive `ALTER TABLE ... ADD INDEX IF NOT EXISTS` migration on `init()`.
