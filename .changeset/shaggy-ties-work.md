---
'@mastra/pg': patch
---

Added storage-level filtering for `Agent.listSuspendedRuns()` thread lookups. When the workflow snapshot column is `jsonb`, the thread id embedded in suspended run snapshots is filtered directly in PostgreSQL and backed by a new expression index, turning thread-scoped suspended-run discovery from a full table scan into an indexed lookup. Part of https://github.com/mastra-ai/mastra/issues/22627
