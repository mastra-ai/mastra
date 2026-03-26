---
'@mastra/core': patch
---

- **SearchEngine**: `indexMany` uses `p-map` with a default concurrency of four when vector embedding runs, with optional `concurrency` and `stopOnError` (same semantics as `p-map`). Lazy vector indexing flushes pending documents at the same concurrency.

- **Workspace**: Search auto-indexing reads files in parallel with a bounded concurrency, skips unreadable paths, awaits batch indexing, and falls back to per-file indexing when the batch path throws. Successful single-file indexing returns the path so callers can track what was indexed.
