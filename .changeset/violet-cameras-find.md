---
'@mastra/memory': patch
---

Fixed an unbounded `Map` cache in `Memory.embedMessageContent` that retained every distinct message embedding for the life of the process and could return another message's embeddings on 32-bit hash collisions (~77k distinct contents). The cache is now an LRU (`max: 1000`) keyed by xxhash64, so long-running processes hold a bounded working set and collisions become negligible (closes #17900).
