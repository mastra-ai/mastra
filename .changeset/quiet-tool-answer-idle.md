---
'@mastra/core': patch
---

Fixed AgentController sessions getting stuck as "running" after a failed tool answer. If answering a suspended tool call or a tool approval fails before the run restarts, the session now goes back to idle. The tool call stays waiting, and you can retry it. Fixes #26870.
