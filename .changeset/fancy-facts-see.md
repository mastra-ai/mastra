---
'@mastra/core': patch
---

Added an `expectedSuspendedAt` condition to background task updates. A write fenced on a suspension time is only applied while the task is still in that same suspension, so an answer meant for an earlier suspension can no longer overwrite a later one.

Fixed a delayed background task resume answering the wrong suspension. If a task was resumed another way and suspended again before a resume request was processed, that request used to resume the new suspension with the old data. It is now dropped.
