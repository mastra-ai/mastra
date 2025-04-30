---
'@mastra/vectorize': patch
'@mastra/pinecone': patch
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/chroma': patch
'@mastra/libsql': patch
'@mastra/qdrant': patch
'@mastra/rag': patch
'@mastra/astra': patch
'@mastra/pg': patch
---

Moved vector store specific prompts from @mastra/rag to be exported from the store that the prompt belongs to, ie @mastra/pg
