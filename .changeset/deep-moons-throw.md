---
'@mastra/daytona': patch
---

Switched from synthetic numeric PIDs to using Daytona session IDs as `ProcessHandle.pid`, removing the `_nextPid` counter and `_sessionId` field.
