---
"@mastra/core": minor
"@mastra/pg": minor
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
---

Support metadata-only queries in vector stores by making `queryVector` optional in the `QueryVectorParams` interface.

PgVector now supports querying by metadata filters alone without providing a query vector — useful when you need to retrieve records by metadata without performing similarity search. Other vector stores will throw a clear error if `queryVector` is omitted, since their backends require a vector for queries.

Also fixes documentation where the `query()` parameter was incorrectly named `vector` instead of `queryVector`.
