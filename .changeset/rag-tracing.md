---
'@mastra/core': minor
'@mastra/rag': minor
---

Add RAG tracing support to track retrieval operations

This change introduces comprehensive RAG (Retrieval-Augmented Generation) tracing capabilities:

- **New Span Type**: Added `RAG_RETRIEVAL` span type with detailed attributes for tracking vector search operations
- **RAG Span Attributes**: Captures query text, embedding model, vector store details, result count, similarity scores, filtering, and database configurations
- **Vector Search Tracing**: The `vectorQuerySearch` utility now creates RAG spans that track:
  - Query text and embedding model used
  - Vector store and index information
  - Top-K parameter and actual result count
  - Filter application and criteria
  - Similarity score statistics (min, max, average)
  - Database-specific configurations
- **Reranking Tracing**: Creates child RAG spans when reranking is performed, capturing:
  - Reranking model information
  - Initial vs. final result counts
  - Reranking success/failure status

When agents use RAG through the vector query tool, traces will now include detailed information about the retrieval process, making it easier to debug, optimize, and understand RAG operations in production.
