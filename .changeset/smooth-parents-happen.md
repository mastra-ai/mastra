---
'@mastra/memory': patch
'@mastra/client-js': patch
'@mastra/server': patch
'@internal/playground': patch
---

add Studio support for observational memory extractors

Adds `bufferedObservationChunks` and extraction metadata to the buffer-status API and client types so extracted values flow through during live streaming. Renders observational memory indicators from a normalized cycle model that preserves extraction data across streaming, refetch, reload, activation, and failure transitions.
