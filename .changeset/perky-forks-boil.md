---
'@mastra/client-js': minor
'@mastra/mcp-apps-components': patch
'@mastra/playground-ui': patch
'@mastra/react': patch
'@mastra/server': patch
---

Added progressive word search options to the observability client. `querySpans`, `queryTraces`, `aggregateSpans` and `aggregateTraces` accept `progressive: true` and a `continuation` token, and return the `searchedRange`, the next `continuation` and whether aggregate chunks are `mergeable`. Each call also accepts an `AbortSignal`.
