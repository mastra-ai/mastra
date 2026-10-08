---
'@mastra/observability': patch
---

Spans now keep and export the `links` they were started with, and any links set on the span before it ends. Links with invalid trace or span IDs are ignored.
