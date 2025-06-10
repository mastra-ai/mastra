---
"@mastra/pg": patch
---

fix(pg): allow dotted attribute keys in `getTraces` by using `parseFieldKey` instead of `parseSqlIdentifier`
