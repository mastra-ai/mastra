---
'@mastra/cloudflare-d1': patch
'@mastra/elasticsearch': patch
'@mastra/turbopuffer': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/opensearch': patch
'@mastra/couchbase': patch
'@mastra/s3vectors': patch
'@mastra/vectorize': patch
'@mastra/dynamodb': patch
'@mastra/pinecone': patch
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/core': patch
'@mastra/chroma': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/qdrant': patch
'@mastra/astra': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/pg': patch
---

Standardize error IDs across all storage and vector stores using centralized helper functions (`createStorageErrorId` and `createVectorErrorId`). This ensures consistent error ID patterns (`MASTRA_STORAGE_{STORE}_{OPERATION}_{STATUS}` and `MASTRA_VECTOR_{STORE}_{OPERATION}_{STATUS}`) across the codebase for better error tracking and debugging.
