---
'@mastra/observability': patch
---

Spans now keep and export the `links` they were started with, and any links set on the span before it ends. Links whose IDs are not valid W3C trace and span IDs (32 and 16 lowercase hex characters, not all zeros) are ignored.
