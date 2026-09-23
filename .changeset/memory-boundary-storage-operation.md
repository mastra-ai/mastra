---
'@mastra/core': minor
---

Added an optional `advanceMemoryTokenBoundary` operation to the memory storage contract. When a storage backend supports atomic updates, `messageHistory` trim boundaries now persist safely across multiple app instances sharing one database, so removed history cannot reappear in later turns. Backends without support return the stored boundary without persisting a new one, so the trim boundary isn't shared across independent storage instances and trimmed messages can reappear in a later turn. The token budget is still applied on every request.
