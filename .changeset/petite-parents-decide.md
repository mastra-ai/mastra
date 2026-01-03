---
'@mastra/rag': minor
---

Add dynamic vectorStore resolver support for multi-tenant applications
The vectorStore option in createVectorQueryTool and createGraphRAGTool now accepts a resolver function in addition to static instances. This enables multi-tenant setups where each tenant has isolated data in separate PostgreSQL schemas.
