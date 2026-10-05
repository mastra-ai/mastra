---
'@mastra/client-js': minor
---

Removed the options argument from AgentController `switchModel`. Model selection now persists to the active thread and remains active when its mode changes.

**Before**

```ts
await controller.switchModel('openai/gpt-5.6', { modeId: 'build', scope: 'thread' });
```

**After**

```ts
await controller.switchModel('openai/gpt-5.6');
```
