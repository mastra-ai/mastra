---
'@mastra/react': minor
---

Added a headless React hook that subscribes before loading history and projects Mastra's native thread run state without importing web UI components.

```tsx
const { messages, snapshot, sendMessage, abort } = useThreadSignals({
  client,
  resourceId: 'user-1',
  threadId: 'thread-1',
});
```
