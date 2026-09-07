---
'@mastra/temporal': patch
'@mastra/inngest': patch
'@mastra/core': patch
---

Removed the unused `executeDurableToolCalls` helper and its `ToolExecutionContext`/`ToolExecutionError` types from `@mastra/core/agent/durable`. This code was never wired into any agent loop; both the durable and regular loops execute tools through their own step implementations.
