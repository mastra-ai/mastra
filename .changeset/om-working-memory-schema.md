---
'@mastra/memory': patch
---

Fixed observational memory saving working memory that doesn't match your schema. This applies when you set `workingMemory.schema` and enable `observationalMemory.observation.manageWorkingMemory`. Each new document is now checked against your schema before it's saved. If a document has values outside the allowed list, wrong types, missing fields, or extra keys, it's skipped and your previous working memory is kept. If the model returns `null`, working memory stays unchanged.
