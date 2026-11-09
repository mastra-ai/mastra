---
'@mastra/rag': patch
---

`rerank` and `rerankWithScorer` now throw a clear error when `topK` is not a nonnegative integer (for example `-1`, `1.5`, `NaN`, or `Infinity`), instead of silently returning a surprising number of results. `topK: 0` still returns an empty list.
