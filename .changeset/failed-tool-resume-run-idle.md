---
'@mastra/core': patch
---

Fixed AgentController sessions getting stuck in a running state with no run id when resuming, approving, or declining a suspended tool call failed before the run started. The session now returns to idle, the tool call stays parked, and it can be answered again.
