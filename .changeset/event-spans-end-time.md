---
'@mastra/observability': patch
---

Fixed event spans (such as `model_chunk` spans for `tool-result` and `tool-call-approval` chunks) being stored and exported with `endedAt: null` in completed runs, which made them look like they were still running. Event spans are point-in-time, so they now end at the instant they start: `endTime` equals `startTime` and their duration is zero. Event spans no longer emit duration metrics. Fixes [#24233](https://github.com/mastra-ai/mastra/issues/24233).
