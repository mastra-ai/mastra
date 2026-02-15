---
'@mastra/core': patch
---

Fixed semantic recall search in Mastra Studio returning no results when using non-default embedding dimensions (e.g., fastembed with 384-dim). The SemanticRecall processor now probes the embedder for its actual output dimension, ensuring the vector index name matches between write and read paths. Previously, the processor defaulted to a 1536-dim index name regardless of the actual embedder, causing a mismatch with the dimension-aware index name used by Studio's search. Fixes #13039
