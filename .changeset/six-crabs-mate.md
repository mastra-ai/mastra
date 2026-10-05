---
'@mastra/client-js': minor
---

Removed the modeId option from AgentController switchModel. Model selection now applies to the session and remains active when its mode changes.

**Before**

```ts
await controller.switchModel('openai/gpt-5.6', { modeId: 'build', scope: 'thread' });
```

**After**

```ts
await controller.switchModel('openai/gpt-5.6', { scope: 'thread' });
```
