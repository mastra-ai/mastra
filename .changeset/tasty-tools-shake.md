---
'@mastra/libsql': minor
'@mastra/core': patch
---

Added the experimental knowledge storage contract in `@mastra/core` and its LibSQL persistence in `@mastra/libsql`. Create a node with `storage.stores.knowledge.createNode(...)`, then attach durable knowledge with `appendKnowledge({ node, ... })`.
