---
'@mastra/memory': patch
---

Working-memory updates behave as before. Nested fields merge, fields set to `null` are removed, and arrays are replaced. Conversation replay now uses the same rules to rebuild recorded working memory.
