---
'@mastra/core': minor
---

preserve authorization context in code mode dispatch

`AgentToolExecutionContext.messages` and `AgentToolExecutionContext.suspend` are now optional: the nested agent context built for code-mode dispatch carries only agent/thread/resource IDs, so strict-mode consumers reading `context.agent.messages` or calling `context.agent.suspend(...)` must now optional-chain.
