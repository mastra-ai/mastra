---
'@mastra/turbopuffer': major
'@mastra/deployer': major
'@mastra/opensearch': major
'@mastra/couchbase': major
'@mastra/s3vectors': major
'@mastra/vectorize': major
'@mastra/server': major
'@mastra/pinecone': major
'@mastra/mongodb': major
'@mastra/upstash': major
'@mastra/core': major
'@mastra/chroma': major
'@mastra/libsql': major
'@mastra/qdrant': major
'@mastra/astra': major
'@mastra/lance': major
'@mastra/pg': major
---

Every Mastra primitive (agent, MCPServer, workflow, tool, processor, scorer, and vector) now has a get, list, and add method associated with it. Each primitive also now requires an id to be set.

Primitives that are added to other primitives are also automatically added to the Mastra instance
