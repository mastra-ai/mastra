---
'@mastra/server': patch
'@mastra/core': patch
---

Fix type safety for message ordering - restrict `orderBy` to only accept `'createdAt'` field

Messages don't have an `updatedAt` field, but the previous type allowed ordering by it, which would return empty results. This change adds compile-time type safety by making `StorageOrderBy` generic and restricting `StorageListMessagesInput.orderBy` to only accept `'createdAt'`. The API validation schemas have also been updated to reject invalid orderBy values at runtime.

