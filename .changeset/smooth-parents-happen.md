---
'@mastra/server': patch
'@mastra/playground': patch
---

normalize om extraction indicators in studio

Adds bufferedObservationChunks to the buffer-status response
schema so extraction fields flow through during live streaming.
Renders observational memory indicators from a normalized cycle
model that preserves extraction data across streaming, refetch,
reload, activation, and failure transitions.
