---
'@mastra/server': patch
'@mastra/playground': patch
---

add Studio support for observational memory extractors

Adds `bufferedObservationChunks` to the buffer-status response schema so extracted values flow through during live streaming. Renders observational memory indicators from a normalized cycle model that preserves extraction data across streaming, refetch, reload, activation, and failure transitions.
