---
'@mastra/rag': patch
---

Fixed `rag chunk` tracing spans so they record `chunkSize` from the `maxSize` chunk option. Previously the attribute was always empty.
