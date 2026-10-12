---
'@mastra/client-js': patch
'@mastra/react': patch
'@mastra/server': patch
'@mastra/core': patch
---

Fixed agent experiment results losing their error details. A failed agent run now stores `error.message` and `error.stack` instead of an empty object. Added exported `AgentExperimentOutput`, `ScorerExperimentOutput`, and `ExperimentResultOutput` types that describe what each experiment target stores in `output`.
