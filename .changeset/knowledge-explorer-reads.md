---
'@mastra/core': patch
---

Added read-only Knowledge explorer helpers (`readKnowledgeGraph`, `readKnowledgeNode`, `searchKnowledgeNodes`, `readKnowledgeActivity`) to `@mastra/core/knowledge`. They return the graph, node detail, search hits and activity a viewer sees for a given set of scope tags, and never write.
