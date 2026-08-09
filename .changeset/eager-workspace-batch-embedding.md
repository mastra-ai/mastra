---
'@mastra/core': patch
---

Fixed Workspace search indexing sending one embedding request per document.

A batch-capable embedder (one branded with `batch: true`) was only used when the search engine ran in lazy mode, which `Workspace` never enables. Indexing a directory therefore cost one embedding round trip per file no matter what the embedder supported — indexing 500 files made 500 requests.

`indexMany` now groups documents into batched embedder calls whenever the configured embedder is batch-capable, so those 500 files take 2 requests with `maxBatchSize: 256`.

Vector writes are bounded as well: a single `upsert` now carries at most `min(maxBatchSize, 100)` vectors instead of the whole batch, since each document's metadata carries its full text and several vector stores reject oversized write requests. Lazy-mode rebuilds that previously issued one large `upsert` per flush now issue several bounded ones.

An embedder declaring an unusable `maxBatchSize` (`0`, negative, or `NaN`) now falls back to the default batch size instead of hanging or silently indexing nothing.
