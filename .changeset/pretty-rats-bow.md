---
'@mastra/core': patch
---

Fixed a crash in agent networks when observational memory is configured with `scope: 'thread'`. The network's completion and final-result steps now forward the thread context to the routing agent, so observational memory no longer throws `ObservationalMemory (scope: 'thread') requires a threadId` at the end of a successful network run.

Fixes #15736 and #13651.
