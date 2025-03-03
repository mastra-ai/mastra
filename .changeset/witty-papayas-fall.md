---
'@mastra/core': patch
---

When converting JSON schemas to Zod schemas, we were sometimes marking optional fields as nullable instead, making them required with a null value, even if the schema didn't mark them as required
