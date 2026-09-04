---
'@mastra/core': minor
---

Added `handlers.onAction` to agent channels so apps can handle button clicks and select changes from their own cards. The built-in tool approval handling is available as `defaultHandler`, and `onAction: false` disables it. Fixes #22629

```ts
const agent = new Agent({
  // ...
  channels: {
    adapters: { slack: createSlackAdapter() },
    handlers: {
      onAction: async (event, defaultHandler) => {
        if (event.actionId === 'retry') {
          await event.thread?.post('Retrying...');
          return;
        }
        await defaultHandler();
      },
    },
  },
});
```
