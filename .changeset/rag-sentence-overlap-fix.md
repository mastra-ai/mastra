---
'@mastra/rag': patch
---

Fixed sentence chunking with `overlap` so it no longer returns chunks larger than `maxSize` or a duplicate chunk that contains only the overlap from the previous chunk. Carried-over overlap is now trimmed until the next sentence fits.
