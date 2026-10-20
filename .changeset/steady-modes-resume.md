---
'@mastra/core': patch
---

Fixed paused tool calls picking up a different mode's tools when they resume. Approving, declining, or answering a paused tool call now uses the tools of the mode the run was paused in. Before, switching modes while a call waited gave the continuation the new mode's tools. A switch to an unrestricted mode could expose every tool to a run that started in a restricted one. The same applied when answering a suspension from another thread. Approving a plan still moves the run to the plan's transition mode. Fixes #27873.
