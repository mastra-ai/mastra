---
'@mastra/rag': patch
---

Fixed JSON chunking silently dropping array items and object fields. Groups smaller than `minSize` (including the default of `maxSize - 200`) were discarded or overwritten, so a document could lose data or return no chunks at all. Every value in the input now appears in the output. `minSize` is still accepted but no longer causes content to be discarded.
