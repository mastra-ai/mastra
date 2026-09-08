---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
---

Added support for filtering experiment results by tags in `listExperimentResults`. All requested tags must be present on a result for it to match.
