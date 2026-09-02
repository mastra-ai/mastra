---
'@mastra/core': patch
---

Persist run-level `scorerIds` on experiments started with `startExperimentAsync` (and therefore on runs triggered from the API/Studio), matching `createExperiment`. Reruns from Studio now prefill the original scorers.
