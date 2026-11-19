---
'@mastra/react': minor
---

Added progressive word search to `useQuerySpans` and `useTraceQuery`: pass `progressive` and each page is one time chunk, newest first, with `searchedRange`, `searching`, `stop()` and a separate `chunkError` that keeps the rows already loaded. Added `useProgressiveSpanAggregate`, `useProgressiveTraceAggregate` and `useProgressiveSearchAvailable`.
