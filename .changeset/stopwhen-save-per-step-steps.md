---
'@mastra/core': patch
---

Fixed `stopWhen` receiving the wrong step content when `savePerStep` is enabled. After a run was resumed (for example after a tool suspended to ask the user a question), a step could show up with no tool results, so conditions such as "stop after N failed tool calls" counted wrong and fired late.
