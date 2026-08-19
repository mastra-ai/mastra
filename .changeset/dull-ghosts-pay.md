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

Added `createExternalExperiment()`, `submitExperimentResult()`, and `finalizeExperiment()` methods so externally executed evaluation runs (for example on Temporal) can report results into a Mastra experiment.
