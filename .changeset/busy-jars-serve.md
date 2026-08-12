---
'@mastra/client-js': minor
'@mastra/server': minor
---

Added multi-resource thread listing for agent controller sessions.

```ts
const threads = await session.listThreads({
  resourceIds: ['workspace-a', 'workspace-b'],
});
```
