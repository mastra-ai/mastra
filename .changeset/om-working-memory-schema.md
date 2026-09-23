---
'@mastra/memory': patch
---

Fixed observational memory saving working memory that doesn't match your schema. This applies when you set `workingMemory.schema` and enable `observationalMemory.observation.manageWorkingMemory`. Each new document is now checked against your schema before it's saved. If a document fails your schema, for example because of a value outside the allowed list, a wrong type, or a missing field, it's skipped and your previous working memory is kept. If the model returns `null`, working memory stays unchanged.
