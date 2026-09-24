---
'@mastra/memory': patch
---

Fixed Observational Memory saving working memory that does not match your configured `workingMemory.schema`. When `observation.manageWorkingMemory` is enabled, the observer now checks each working memory update against the schema before saving it. An update with values outside an allowed list, wrong types, missing required fields, or disallowed extra fields is skipped, and the previous working memory is kept. A `null` in a field the schema marks optional is treated as not provided, the same as with the working memory tool. Returning `null` still leaves working memory unchanged. Fixes #24240.
