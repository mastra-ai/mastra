---
'@mastra/core': patch
---

Fixed three bugs in the in-memory storage adapter so it behaves like the database adapters:

- `listMessages` now reports `hasMore` correctly when `include` is combined with pagination or several threads. Before, it could report no more pages while filtered messages remained, or report more pages when `include` had already returned every message.
- Saving an existing channel installation again no longer resets its `createdAt`.
- `batchDeleteTraces` with `organizationId` or `resourceId` now deletes only that tenant's spans. Before, it removed the whole trace or nothing, depending on which root span was written last.
