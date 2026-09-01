---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fetch active versions for stored agents and skills in a single `WHERE id IN (...)` query when listing resolved entities, instead of one query per entity. Fixes https://github.com/mastra-ai/mastra/issues/22524
