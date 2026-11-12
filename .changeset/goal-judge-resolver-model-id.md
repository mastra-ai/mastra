---
'@mastra/core': patch
---

A goal judge resolver function now receives the goal's own `judgeModelId`, so an agent that resolves its judge with custom credentials can still honor a per-goal judge model.
