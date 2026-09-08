---
'@mastra/rag': patch
---

Fixed the reference docs for createVectorQueryTool and createGraphRAGTool to describe the actual return shape: relevantContext is an array (chunk metadata objects for vector query, chunk text strings for graph RAG), not a combined string, and sources[].document is only populated by vector stores that return document content (Chroma, Elasticsearch, LanceDB, MongoDB). For other stores such as PgVector, read the chunk text from sources[].metadata.text. Fixes #23252
