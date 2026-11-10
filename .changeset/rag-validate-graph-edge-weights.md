---
'@mastra/rag': patch
---

GraphRAG now rejects nonfinite edge weights when adding an edge or restoring a serialized graph, including `null` produced when JSON serialization converts `NaN`. Finite weights such as zero and negative numbers remain valid.
