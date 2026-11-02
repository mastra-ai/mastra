---
'@mastra/rag': patch
---

Fixed JSON chunking silently dropping array items and nested object fields when a chunk was smaller than `minSize`. Previously, `MDocument.fromJSON(...).chunk({ strategy: 'json' })` could lose data with the default `minSize` (for example, a 150-item array chunked with `maxSize: 2000` kept only 116 items) or return no chunks at all for small inputs. Non-empty array groups and nested-object chunks are now kept even when they are smaller than `minSize`, so `minSize` no longer causes data loss. Split array objects are also now keyed by their index in the source array.
