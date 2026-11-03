---
'@mastra/libsql': minor
'@mastra/pg': minor
'@mastra/mysql': minor
'@mastra/mongodb': minor
---

Store Knowledge listing pins. The pins table gets a `kind` column (`page` or `list`) and a `depth` column, and a page now holds one pin per kind. Existing pins become page pins when the store starts; nothing else changes and no reset is needed.
