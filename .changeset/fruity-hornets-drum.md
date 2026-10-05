---
'@mastra/server': minor
---

Removed `modeId` and `scope` from the AgentController model-switch route. Sessions now persist one current model for the thread.

**Before**

```ts
await fetch('/api/agent-controller/session/model', {
  method: 'POST',
  body: JSON.stringify({ modelId: 'openai/gpt-5.6', modeId: 'build', scope: 'thread' }),
});
```

**After**

```ts
await fetch('/api/agent-controller/session/model', {
  method: 'POST',
  body: JSON.stringify({ modelId: 'openai/gpt-5.6' }),
});
```
