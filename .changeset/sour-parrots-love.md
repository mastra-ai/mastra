---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed observational memory activation selecting too many chunks by refreshing buffered chunk token counts from the current message list before activation. This prevents stale token weights from causing over- or under-activation of buffered observations.
