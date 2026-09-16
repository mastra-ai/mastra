---
'@mastra/rag': patch
---

Fix `MDocument.chunk()` producing chunks larger than `maxSize` when `overlap` is large relative to it. `mergeSplits` picked the overlap window to carry into the next chunk and then appended the split that triggered the flush without checking that the two still fit, so the chunk was emitted over the limit and the size guard only fired one iteration later. The overlap window now drops from its front until the incoming split fits. A single split that cannot fit on its own is still emitted whole, with the existing warning.
