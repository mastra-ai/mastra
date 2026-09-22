---
'@mastra/pg': patch
---

Fixed `listThreads`, `listMessages` and `listMessagesByResourceId` in `@mastra/pg` repeating or skipping rows across pages when many rows share the same `createdAt`/`updatedAt`. Lists are now also ordered by `id` so paging is stable. Fixes #24237.
