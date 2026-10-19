---
'@mastra/core': patch
---

Fixed approved tools added by an input processor running with the suspended run's request context. When you approve a tool call with `approveToolCall({ requestContext })`, a tool that an input processor added now sees the request context you passed, just like a tool defined on the agent.
