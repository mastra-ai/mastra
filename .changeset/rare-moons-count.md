---
'@mastra/core': patch
---

Fixed three bugs in the in-memory storage adapter so it behaves like the database adapters:

- `listMessages` no longer reports `hasMore: true` when you query several threads and `include` already returned every message.
- Saving an existing channel installation again no longer resets its `createdAt`.
- `batchDeleteTraces` with `organizationId` or `resourceId` now deletes only that tenant's spans. Before, it removed the whole trace or nothing, depending on which root span was written last.
