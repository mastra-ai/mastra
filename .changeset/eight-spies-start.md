---
'@mastra/server': minor
'@mastra/client-js': minor
'mastra': patch
---

Added `agentOverrides` to the trigger experiment endpoint (`POST /datasets/:datasetId/experiments`) and `client.triggerDatasetExperiment()`, so you can tweak an agent's instructions, model, and execution options for a single experiment run from the API.
