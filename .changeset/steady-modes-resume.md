---
'@mastra/core': patch
---

Approving, declining, or answering a paused tool call now keeps the tool restriction of the mode the run was paused in. Previously, switching modes while a tool call waited (or answering a suspension that belongs to another thread) gave the continuation the session's current mode's tools, so a switch to an unrestricted mode exposed every tool to a run started in a restricted one. Approving a plan still applies the plan's transition mode. Fixes #27873.
