---
'@mastra/core': minor
---

Added creation-time modeId and modelId to AgentController.createSession so a session is born configured instead of created on defaults and mutated afterwards. The seeds persist like a user-driven switch (a restart restores them), a resumed thread's persisted selection still wins, and an unknown mode fails fast.

```ts
const session = await controller.createSession({
  resourceId: 'project-42',
  threadId: 'thread-7',
  modeId: 'plan',
  modelId: 'openai/gpt-5.2-codex',
});
```

Also added `controller.defaultModeId`, exposing the mode new sessions start in.
