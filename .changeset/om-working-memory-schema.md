---
'@mastra/memory': patch
---

Fixed observational memory saving working memory that doesn't match your schema. When `workingMemory.schema` is set and `observationalMemory.observation.manageWorkingMemory` is enabled, extracted documents are now validated against your schema (Zod or JSON Schema) before they're saved. Invalid documents (bad enum values, wrong types, missing fields, or disallowed keys) are skipped and the previous working memory is kept.
