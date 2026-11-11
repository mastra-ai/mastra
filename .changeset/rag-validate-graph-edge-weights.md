---
'@mastra/rag': patch
---

GraphRAG now rejects nonfinite edge weights when adding an edge or restoring a serialized graph, including `null` produced when JSON serialization converts `NaN`. Finite weights such as zero and negative numbers remain valid.

Previously, `addEdge` accepted `NaN` or infinite weights and `GraphRAG.deserialize` accepted snapshots containing them; both now throw. Compute a finite weight before calling `addEdge` (for example, `graph.addEdge({ source: 'a', target: 'b', weight: 0, type: 'semantic' })` when zero is the intended weight). For affected snapshots, recompute invalid edge weights from the original data before calling `GraphRAG.deserialize`; do not replace missing weights with zero unless that reflects the intended graph.
