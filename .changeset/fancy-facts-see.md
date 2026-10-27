---
'@mastra/core': patch
---

Added an `expectedSuspendedAt` condition to background task updates. A write fenced on a suspension time is only applied while the task is still in that same suspension, so an answer meant for an earlier suspension can no longer overwrite a later one.
