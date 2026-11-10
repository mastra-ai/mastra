---
'@mastra/rag': patch
---

GraphRAG now rejects non-finite or sparse node and query embeddings instead of producing `NaN` similarity scores. It also copies node embeddings on insertion and access so caller mutations cannot invalidate a graph after validation.
