---
'@mastra/observability': patch
---

Spans now keep and export the `links` they were started with. Links with invalid trace or span IDs are ignored.
