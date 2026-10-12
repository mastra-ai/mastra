---
'@mastra/client-js': patch
'@mastra/react': patch
'@mastra/server': patch
'@mastra/core': patch
---

Results returned by `useDatasetExperimentResults` now include `targetType`, so you can check it to get typed agent and scorer outputs (for example `result.output?.text` when `result.targetType === "agent"`).
