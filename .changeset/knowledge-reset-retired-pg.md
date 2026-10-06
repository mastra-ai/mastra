---
'@mastra/pg': patch
---

Explicit Knowledge schema resets now also drop the retired v1 `mastra_knowledge_cursors` table, so upgraded databases no longer keep an orphaned cursor table.
