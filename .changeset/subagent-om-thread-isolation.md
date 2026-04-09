---
'@mastra/core': patch
---

Fixed subagent writing observations to the parent agent's memory thread. When a parent agent spawns a subagent via `createSubagentTool`, the subagent now receives its own isolated request context with `threadId` and `resourceId` cleared, preventing it from corrupting the parent's observation history.
