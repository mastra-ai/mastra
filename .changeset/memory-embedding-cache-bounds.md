---
"@mastra/memory": patch
---

Fixed the semantic recall embedding cache so it no longer grows without bound and can no longer return another message's embeddings.

The in-process cache that stores embeddings for recall now uses an LRU with a fixed capacity, so a long-running `Memory` instance stops accumulating every message and query it has ever embedded (each entry holds chunk text plus vectors) for the lifetime of the process. Cache keys also moved from a 32-bit hash to a 64-bit hash, removing a collision that could make one message silently receive a different message's cached embeddings — corrupting what gets indexed and recalled.

No API changes; semantic recall results for correctly cached content are unchanged.
