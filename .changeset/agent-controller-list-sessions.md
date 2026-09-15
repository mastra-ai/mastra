---
'@mastra/core': patch
---

`AgentController.listSessions()` returns every live session the controller created and has not torn down, so a host can apply a shared setting change to the sessions it covers instead of waiting for their next boot.
