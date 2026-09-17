---
'@mastra/pg': patch
---

Ordered `listThreads`, `listMessages` and `listMessagesByResourceId` by the row id after the sort timestamp. Rows that share one `createdAt` or `updatedAt` had no stable order, so an offset page could repeat one row and skip another after an update between pages. The public `orderBy` option is unchanged.
