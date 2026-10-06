---
'@mastra/core': patch
---

Deprecated the Knowledge curation cursor API: `KnowledgeCurationCursor`, `KnowledgeStorage.getCurationCursor()`, and `KnowledgeStorage.advanceCurationCursor()`. Observation-time curate is now the only Knowledge writer and needs no cursor, so both methods now throw instead of reading or writing cursor state, and Knowledge no longer creates the `mastra_knowledge_cursors` table. Nothing in Mastra calls these methods. The `TABLE_KNOWLEDGE_CURSORS` and `KNOWLEDGE_CURSORS_SCHEMA` exports remain (deprecated) so adapters built against earlier Core versions keep resolving them. No peer dependency ranges change.
