---
'@mastra/core': patch
---

Fixed harness follow-up messages sent immediately after an abort so they wait for the aborted stream to finish cleaning up before starting the next run.
