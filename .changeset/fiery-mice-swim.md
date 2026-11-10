---
'@mastra/rag': patch
---

`GraphRAG.query()` now rejects `topK` and `randomWalkSteps` values that are not positive integers, and `restartProb` values that are not finite numbers strictly between 0 and 1. This prevents silent empty or truncated results and unbounded walks.
