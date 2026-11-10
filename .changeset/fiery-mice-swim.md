---
'@mastra/rag': patch
---

`GraphRAG.query()` now rejects `topK` and `randomWalkSteps` values that are not positive integers, and `restartProb` values that are not finite numbers strictly between 0 and 1. This prevents silent empty or truncated results and rejects infinite step counts that could cause unbounded walks. Replace fractional counts with positive integers; for example, a fractional `topK` was previously truncated:

```ts
// Before
graph.query({ query: embedding, topK: 1.5 });
// After
graph.query({ query: embedding, topK: 1 });
```
