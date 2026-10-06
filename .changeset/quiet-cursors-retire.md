---
'@mastra/core': patch
---

Deprecated the Knowledge curation cursor API: `KnowledgeCurationCursor`, `KnowledgeStorage.getCurationCursor()`, and `KnowledgeStorage.advanceCurationCursor()`. Observation-time curate is now the only Knowledge writer and needs no cursor, so both methods now throw instead of reading or writing cursor state, and Knowledge no longer creates the `mastra_knowledge_cursors` table. Current `@mastra/memory` no longer calls these methods, but `@mastra/memory` 1.27.0 through 1.28.1 call them during experimental Subconscious curate and learn passes, so those passes throw with this Core version. If you use experimental Subconscious, upgrade to `@mastra/memory` 1.28.2 or later. The `TABLE_KNOWLEDGE_CURSORS` and `KNOWLEDGE_CURSORS_SCHEMA` exports remain (deprecated) so adapters built against earlier Core versions keep resolving them. No peer dependency ranges change.
