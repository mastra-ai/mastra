---
'@mastra/pg': patch
---

Deprecated the Knowledge curation cursor methods `getCurationCursor()` and `advanceCurationCursor()`. Both now throw, and this store no longer creates the cursor table. Existing cursor tables are left in place.

Before:

```ts
await storage.stores?.knowledge?.advanceCurationCursor({ sourceThreadId: threadId, agent: 'curate', lastKnowledgeId });
```

After: remove cursor calls. Knowledge is now curated as each observation is saved, so no replacement call is needed.

`@mastra/memory` 1.27.0 through 1.28.1 still call these methods during experimental Subconscious curation, which then fails with this store version. If you use experimental Subconscious, upgrade to `@mastra/memory` 1.28.2 or later. No peer dependency ranges change.
