---
"@mastra/pinecone": patch
"@mastra/qdrant": patch
"@mastra/chroma": patch
"@mastra/astra": patch
"@mastra/upstash": patch
"@mastra/mongodb": patch
"@mastra/elasticsearch": patch
"@mastra/opensearch": patch
"@mastra/duckdb": patch
"@mastra/turbopuffer": patch
"@mastra/vectorize": patch
"@mastra/convex": patch
"@mastra/couchbase": patch
"@mastra/lance": patch
"@mastra/libsql": patch
"@mastra/s3vectors": patch
---

Add a clear runtime error when `queryVector` is omitted for vector stores that require a vector for queries. Previously, omitting `queryVector` would produce confusing SDK-level errors; now each store throws a structured `MastraError` with `ErrorCategory.USER` explaining that metadata-only queries are not supported by that backend.
