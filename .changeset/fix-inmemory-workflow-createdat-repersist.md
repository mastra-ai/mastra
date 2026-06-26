---
'@mastra/core': patch
---

Fixed the in-memory workflow store resetting a run's `createdAt` on every re-persist, so it now matches the persistent stores. Re-persisting an existing run preserves the original `createdAt` and only advances `updatedAt`.
