---
'@mastra/memory': patch
---

Fixed `Memory.saveMessages` not populating `role`, `content`, and `created_at` in the vector store metadata. Calls to `GET /api/memory/search` now return matches with the full message shape regardless of whether messages were saved through `agent.generate`/`agent.stream` or written directly via `Memory.saveMessages` (for example through the `POST /api/memory/save-messages` HTTP route used by external agents).
