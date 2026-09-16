---
'@mastra/core': minor
---

Added an optional `advanceMemoryTokenBoundary` operation to the memory storage contract. When a storage backend supports atomic updates, `messageHistory` trim boundaries now persist safely across multiple app instances sharing one database, so removed history cannot reappear in later turns. Backends without support keep the previous behavior and still apply the token budget on every request.
