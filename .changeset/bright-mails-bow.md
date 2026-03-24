---
'@internal/storage-test-utils': patch
'@mastra/astra': patch
'@mastra/chroma': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/cloudflare-d1': patch
'@mastra/convex': patch
'@mastra/couchbase': patch
'@mastra/duckdb': patch
'@mastra/dynamodb': patch
'@mastra/elasticsearch': patch
'@mastra/lance': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/mssql': patch
'@mastra/opensearch': patch
'@mastra/pg': patch
'@mastra/pinecone': patch
'@mastra/qdrant': patch
'@mastra/s3vectors': patch
'@mastra/turbopuffer': patch
'@mastra/upstash': patch
'@mastra/vectorize': patch
---

Updated storage adapters to use `@mastra/storage` for shared schemas and utilities.

- Added `@mastra/storage` as a peer dependency for storage and vector adapter packages
- Moved shared table constants, pagination helpers, SQL identifier parsing, and storage utility imports out of `@mastra/core/storage`
- Kept adapter runtime classes based on `@mastra/core/storage` so existing storage APIs continue to work
