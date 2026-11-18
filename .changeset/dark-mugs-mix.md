---
'@mastra/react': minor
'@mastra/mcp-apps-components': patch
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/server': patch
---

Added progressive word search to `useQuerySpans` and `useTraceQuery`: pass `progressive` and each page is one time chunk, newest first, with `searchedRange`, `searching`, `stop()` and a separate `chunkError` that keeps the rows already loaded. Added `useProgressiveSpanAggregate`, `useProgressiveTraceAggregate` and `useProgressiveSearchAvailable`.
