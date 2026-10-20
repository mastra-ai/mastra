---
'@mastra/memory': patch
---

Fixed Observational Memory merging a turn's remaining output into an already-observed message when a durable or evented agent run is recovered by another worker. The recovered turn now saves the same messages as an uninterrupted run.
