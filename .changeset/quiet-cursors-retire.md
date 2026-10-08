---
'@mastra/core': patch
---

Deprecated the Knowledge curation cursor API: `KnowledgeCurationCursor`, `KnowledgeStorage.getCurationCursor()`, and `KnowledgeStorage.advanceCurationCursor()`. Both methods now throw, and Knowledge no longer creates the `mastra_knowledge_cursors` table. Knowledge is now curated as each observation is saved, so there is no cursor to track.

Before:

```ts
const cursor = await knowledge.getCurationCursor({ sourceThreadId: threadId, agent: 'curate' });
```

After: remove cursor calls. Curation happens automatically when observations are saved, so no replacement call is needed.

`@mastra/memory` 1.27.0 through 1.28.1 still call these methods during experimental Subconscious curation, which then fails with this Core version. If you use experimental Subconscious, upgrade to `@mastra/memory` 1.28.2 or later. The `TABLE_KNOWLEDGE_CURSORS` and `KNOWLEDGE_CURSORS_SCHEMA` exports remain (deprecated) so adapters built against earlier Core versions keep resolving them. No peer dependency ranges change.
