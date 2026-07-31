---
'@mastra/observability': patch
---

Fixed RequestContext serialization to skip excluded spans and use its span-safe representation for exported traces.
