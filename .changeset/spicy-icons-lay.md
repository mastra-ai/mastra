---
'@mastra/core': patch
---

Fixed a crash when importing `@mastra/core/workflows/workflow` from tests or apps, which previously failed with `TypeError: Class extends value undefined is not a constructor or null` (caused by a circular ESM import through the `workflows` barrel).
