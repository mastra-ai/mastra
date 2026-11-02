---
'@mastra/rag': patch
---

Fixed JSON chunking silently dropping array items and nested object fields when a chunk was smaller than `minSize`. Previously, `MDocument.fromJSON(...).chunk({ strategy: 'json' })` could lose data with the default `minSize` (for example, a 150-item array chunked with `maxSize: 2000` kept only 116 items) or return no chunks at all for small inputs. Every item and field is now kept, and chunks still respect `maxSize`.
