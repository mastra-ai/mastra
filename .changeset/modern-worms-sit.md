---
'@mastra/clickhouse': patch
---

Changed ClickHouse background task deletes to use lightweight `DELETE FROM` instead of `ALTER TABLE ... DELETE` mutations with `mutations_sync`. This makes deleted rows immediately invisible to subsequent reads without forcing part rewrites for each delete.

Improved bulk background task deletion to push filtering into ClickHouse instead of fetching all matching task IDs into Node.js memory first. This avoids unnecessary network transfer and out-of-memory risk when deleting large result sets. As a safety guard, calling `deleteTasks` with no filters is now a no-op — use `dangerouslyClearAll` to wipe the table.
