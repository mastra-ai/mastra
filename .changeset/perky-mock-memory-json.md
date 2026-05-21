---
'@mastra/core': patch
---

Fixed MockMemory working memory tool to support partial JSON updates when using schema-based working memory. Previously, sending a partial update would overwrite all existing data. Now for schema-based configs, unchanged fields are preserved automatically.
