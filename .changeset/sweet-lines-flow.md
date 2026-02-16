---
'@mastra/cloudflare-d1': patch
'@mastra/cloudflare': patch
'@mastra/mongodb': patch
'@mastra/pg': patch
'@mastra/core': patch
'@mastra/clickhouse': patch
'@mastra/convex': patch
'@mastra/dynamodb': patch
'@mastra/lance': patch
'@mastra/libsql': patch
'@mastra/mssql': patch
'@mastra/upstash': patch
---

Implemented atomic `updateWorkflowResults` and `updateWorkflowState` across all storage backends. These methods use database-level transactions (row locking, compare-and-swap) to safely merge concurrent step results into workflow snapshots, preventing race conditions when multiple steps complete simultaneously. Stores that don't support concurrent updates (in-memory, LanceDB) are flagged via a new `supportsConcurrentUpdates()` method, and the evented workflow engine will throw a clear error if used with an unsupported store.

