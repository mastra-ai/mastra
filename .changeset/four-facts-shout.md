---
'@mastra/core': patch
---

Added optional stable history paging for Observational Memory. Custom storage adapters can opt in with `supportsObservationHistoryPaging` and implement `listObservationHistory({ threadId, after, limit: 40, order: 'asc' })`, returning `{ messages, hasMore }` ordered by creation time and message ID. Adapters without this capability keep their existing behavior.
