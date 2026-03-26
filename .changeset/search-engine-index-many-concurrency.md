---
'@mastra/core': patch
---

- **SearchEngine**: `indexMany` uses `p-map` with a default concurrency of 8 when vector embedding runs, with optional `concurrency` and `stopOnError` (same semantics as `p-map`). Lazy vector indexing flushes pending documents at the same concurrency, drains the queue before awaiting so concurrent `index` calls are not dropped, loops until the queue is empty before search, dedupes by document id (last wins), and re-queues the batch if a flush throws.

- **Workspace**: Search auto-indexing reads files in parallel with a bounded concurrency, skips unreadable paths, awaits batch indexing, and falls back to per-file indexing when the batch path throws. Successful single-file indexing returns the path so callers can track what was indexed.
