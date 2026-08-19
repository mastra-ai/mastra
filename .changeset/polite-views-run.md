---
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Added `upsertExperimentResult()` to the experiments storage domain and an `attempt` column on experiment results, enabling retry-safe result submission for external experiments (retried submissions with the same `(experimentId, itemId, attempt)` key converge on a single row).
