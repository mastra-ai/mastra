---
'@mastra/playground-ui': patch
'@mastra/inngest': patch
'@mastra/core': patch
---

Make suspendPayload optional when calling `suspend()`
Save value returned as `suspendOutput` if user returns data still after calling `suspend()`
Automatically call `commit()` on uncommitted workflows when registering in Mastra instance
Show actual suspendPayload on Studio in suspend/resume flow

