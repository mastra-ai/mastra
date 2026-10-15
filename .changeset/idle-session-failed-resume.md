---
'@mastra/core': patch
---

Fixed an AgentController Session staying busy after a tool resume, approval, or decline failed before its run started. Previously `session.run.isRunning()` kept returning `true` with no run id, so later messages were routed to a run that did not exist. The session now returns to idle, the tool call stays pending, and the response can be retried.
