---
'@mastra/playground-ui': patch
'@mastra/cloudflare-d1': patch
'@mastra/turbopuffer': patch
'@mastra/clickhouse': patch
'@mastra/opensearch': patch
'@mastra/couchbase': patch
'@mastra/vectorize': patch
'@mastra/server': patch
'@mastra/pinecone': patch
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/core': patch
'@mastra/chroma': patch
'@mastra/libsql': patch
'@mastra/qdrant': patch
'@mastra/astra': patch
'@mastra/pg': patch
---

Change all public functions in vector stores to use named args and prepare to phase out positional args
