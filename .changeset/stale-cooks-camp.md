---
'@mastra/qdrant': patch
'@mastra/lance': patch
---

Fixed intermittent failures in the indexed score-semantics tests by retrying with a freshly trained index when Lance's randomized HNSW graph construction leaves the far vector cluster unreachable.
