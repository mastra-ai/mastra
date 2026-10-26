---
'@mastra/observability': patch
---

Model inference spans now keep the `spanId` of the span that added each system message, so traces show where every system message came from.
