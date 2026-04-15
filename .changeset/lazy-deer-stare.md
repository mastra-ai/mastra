---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mongodb': patch
---

Added `mastra_rollouts` storage domain for LibSQL, PostgreSQL, and MongoDB with full rollout lifecycle CRUD and efficient indexes on `(agentId, status)`.
