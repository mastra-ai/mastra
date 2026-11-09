---
'@mastra/rag': patch
---

`rerank` and `rerankWithScorer` now throw a clear error when `topK` is not a nonnegative integer (for example `-1`, `1.5`, `NaN`, or `Infinity`), instead of silently returning a surprising number of results. `topK: 0` still returns an empty list.

The vector query and graph RAG tools now round a fractional `topK` down (for example `2.5` becomes `2`), and fall back to the default when the result is below 1, so a fractional value from the model keeps returning results.
