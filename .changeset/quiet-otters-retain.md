---
'@mastra/core': patch
---

Output processors can now add text to an agent's response when observational memory is enabled and the final step is empty after a tool call. That text now streams and is saved for durable and evented agents, the same as for standard agents.
