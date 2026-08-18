---
'@mastra/core': minor
'@mastra/libsql': patch
---

Added experimental scoped knowledge nodes, records, and durable curation state to `@mastra/core`, with LibSQL support in `@mastra/libsql`. Use `storage.stores.knowledge.listKnowledgeRelatedTo({ node, scope })` to read visible related records.
