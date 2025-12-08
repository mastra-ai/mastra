---
'@mastra/core': patch
---

Fix toolCallId propagation in agent network tool execution. The toolCallId property was undefined at runtime despite being required by TypeScript type definitions in AgentToolExecutionContext. Now properly passes the toolCallId through to the tool's context during network tool execution.
