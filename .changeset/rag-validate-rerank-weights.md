---
'@mastra/rag': patch
---

`rerank` and `rerankWithScorer` now reject component weights that are not finite numbers between 0 and 1, instead of silently inverting or amplifying rankings.
