---
'@mastra/core': patch
---

Added read-only Knowledge explorer helpers to `@mastra/core/knowledge`: `readKnowledgeGraph` and `windowKnowledgeGraph` (node and record windows with wikilink edges and pin accents, via `KnowledgeWikilinkResolver` and `loadKnowledgePins`), `readKnowledgeNode`, `readKnowledgeActivity`, and `searchKnowledgeNodes` with `knowledgeSearchHit` and `knowledgeSearchRank`. They take a resolved scope and return what a viewer of that scope sees; they never write.
