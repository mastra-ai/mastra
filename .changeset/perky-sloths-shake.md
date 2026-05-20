---
'@mastra/core': patch
---

Fixed thread metadata updates to merge with existing fields instead of replacing them. Previously, updating a thread's metadata would silently drop any fields not included in the update. Now existing metadata fields are preserved when updating.

Fixed MockMemory working memory tool to support partial JSON updates when using schema-based working memory. Previously, sending a partial update would overwrite all existing data. Now for schema-based configs, unchanged fields are preserved automatically (matching @mastra/memory behavior).

Fixed MockMemory constructor to preserve workingMemory config options (like schema) when enableWorkingMemory is true.
