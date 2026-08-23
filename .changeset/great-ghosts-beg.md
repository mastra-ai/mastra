---
'@mastra/core': patch
---

Fixed Memory silently falling back to the default 1536-dim vector index when the embedder's dimension probe fails. Semantic recall now fails loudly with a clear error instead of silently dropping writes or orphaning the vector index after an embedder switch.
