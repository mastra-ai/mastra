---
'@mastra/core': patch
---

Clarified that `completionStartTime` on `MODEL_INFERENCE` spans is the first-chunk time of that provider call. In a run where the model calls a tool and then responds again, each model inference span carries its own value, so time to first chunk can be computed per call as `completionStartTime - startTime`.
