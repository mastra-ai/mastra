---
'@mastra/core': minor
'@mastra/rag': patch
---

Added GraphRAGStorage domain to MastraStorage for persisting knowledge graphs between sessions. The GraphRAG tool now automatically saves and loads graphs from storage when available, eliminating the need to rebuild graphs from scratch on every session. Includes in-memory implementation; LibSQL/PG adapters can be added as follow-ups.
