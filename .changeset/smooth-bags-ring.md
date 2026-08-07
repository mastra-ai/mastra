---
'@mastra/core': patch
---

Fixed the in-memory storage adapter returning messages from other resources when `listMessages` was called with both `resourceId` and `include`. The pinned messages and their surrounding context are now scoped to `resourceId`, so an ID owned by another resource is skipped.
