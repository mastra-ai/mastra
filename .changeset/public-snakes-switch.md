---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/astra': patch
'@mastra/chroma': patch
'@mastra/couchbase': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/opensearch': patch
'@mastra/pg': patch
'@mastra/pinecone': patch
'@mastra/qdrant': patch
'@mastra/turbopuffer': patch
'@mastra/upstash': patch
'@mastra/vectorize': patch
---

Change all public functions and constructors in vector stores to use named args and prepare to phase out positional args
