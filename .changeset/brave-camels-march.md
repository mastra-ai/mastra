---
'@mastra/core': patch
---

Added an internal `Agent.__setThreadRuntimeAgent()` hook so durable wrappers that are not `Agent` subclasses can route signal-started idle runs through their own `stream()`. Also exported `agentThreadStreamRuntime` from `@mastra/core/agent/durable` for durable-agent integrations. Related to [#23800](https://github.com/mastra-ai/mastra/issues/23800).
