---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added `listVisibleKnowledgeIds` to Knowledge storage. It takes up to 1,000 node and record ids and returns the ones visible in the given scopes, applying the same node and record visibility rules as other Knowledge reads in a single bounded query.
