---
'@mastra/pg': patch
---

Fixed `PostgresStore.init()` blocking writes to `mastra_workflow_snapshot` while it builds the workflow run status and thread id expression indexes. On a table that already holds many runs, the build could keep other processes from saving workflow snapshots until it finished. `init()` now builds both indexes with `CREATE INDEX CONCURRENTLY`, like the other default indexes. The exported schema DDL is unchanged.
