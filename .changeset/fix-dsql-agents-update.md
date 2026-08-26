---
'@mastra/dsql': patch
---

Fix missing $ prefix on the WHERE id placeholder in AgentsDSQL.update(), which caused "operator does not exist: text = integer" on every agent update.
