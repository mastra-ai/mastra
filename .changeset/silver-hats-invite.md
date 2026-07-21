---
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/core': minor
'@mastra/react': minor
'mastra': patch
---

Added request-scoped model overrides to agent execution and approvals, and fixed Studio model selection so each tab can use a different model without changing the agent's configured default.

```ts
await agent.stream(messages, { model: 'google/gemini-2.5-flash' });
```
