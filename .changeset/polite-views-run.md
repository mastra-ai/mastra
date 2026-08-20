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

Added `upsertExperimentResult()` to the experiments storage domain plus an `attempt` column on experiment results and a nullable target with an optional `scorerIds` column on experiments, enabling retry-safe result writes for caller-driven experiments (retried submissions with the same `(experimentId, itemId, attempt)` key converge on a single row).
