---
'@mastra/core': patch
---

Fixed agent trajectories dropping thrown tool calls and using display labels as tool names. Trajectories now keep failed calls with success:false and prefer canonical tool identity from entityId/entityName. (#23462)
