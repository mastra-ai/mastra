---
'@mastra/core': minor
---

Added creation-time modeId and modelId to AgentController.createSession so a session is born configured instead of created on defaults and mutated afterwards. The seeds persist, so a restart restores them; a resumed thread's persisted selection wins over them; and an unknown mode fails fast.

```ts
const session = await controller.createSession({
  resourceId: 'project-42',
  threadId: 'thread-7',
  modeId: 'plan',
  modelId: 'openai/gpt-5.6-sol',
});
```

Also added `controller.defaultModeId`, exposing the mode new sessions start in.
