---
'@mastra/pg': patch
---

Fixed `PostgresStore.init()` blocking writes to `mastra_workflow_snapshot` while it builds the workflow run status and thread id expression indexes. On a table that already holds many runs, the build could keep other processes from saving workflow snapshots until it finished. `init()` now builds both indexes with `CREATE INDEX CONCURRENTLY`, like the other default indexes. The exported schema DDL is unchanged.

Concurrent index builds no longer silently retry as a blocking `CREATE INDEX`. Invalid indexes left behind by an interrupted concurrent build (`pg_index.indisvalid = false`) are now dropped and rebuilt instead of being treated as present, and every index build logs when it starts and how long it took. To build indexes outside of deploys, pre-create them with `CREATE INDEX CONCURRENTLY` and set `skipDefaultIndexes: true`.
