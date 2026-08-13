---
'@mastra/core': minor
---

Added a `resourceIds` option to the agent controller session's `thread.list` so callers can list threads across specific resources.

```ts
const threads = await session.thread.list({
  resourceIds: ['workspace-a', 'workspace-b'],
});
```

Each resource is read with its own indexed query instead of scanning every thread in storage.
