---
'@mastra/core': patch
---

Handle maxRetries in agent.generate/stream properly. Add deprecation warning to top level abortSignal in AgentExecuteOptions as that property is duplicated inside of modelSettings as well.
