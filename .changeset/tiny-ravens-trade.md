---
'@mastra/core': patch
'@mastra/pg': patch
---

Replaced the generic Factory distributed-lock capability with optional serializable transactions for database-enforced relationship coordination.
