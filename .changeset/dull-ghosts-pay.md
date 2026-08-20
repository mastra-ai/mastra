---
'@mastra/client-js': minor
'@mastra/server': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Added `createDatasetExperiment()`, `runExperimentItem()`, `submitExperimentResult()`, and `finalizeExperiment()` methods so a caller-owned orchestrator (for example Temporal) can drive an experiment loop while Mastra either executes each item server-side or ingests externally computed results.
