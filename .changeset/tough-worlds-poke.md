---
'@mastra/observability': patch
---

Fixed event spans (such as `model_chunk` spans for `tool-result` and `tool-call-approval` chunks) being exported with `endedAt: null` in completed runs. Event spans are point-in-time, so they now carry an end time equal to their start time and are no longer mistaken for still-running spans. Fixes #24233.
