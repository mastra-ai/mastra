---
'@mastra/core': patch
---

Fixed recovery of user input during an active thread run without changing message persistence. Agent and AgentController now expose `getActiveThreadInputMessages({ resourceId, threadId })` for local run input.
