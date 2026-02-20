---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed Memory.recall() to include pagination metadata (total, page, perPage, hasMore) in its response. Updated the base MastraMemory.recall() return type to include pagination fields, ensuring type compatibility between the abstract class and concrete implementation. Fixes #13277
