---
'@mastra/core': minor
---

Added initial metadata support when creating agent controller threads.

```ts
const thread = await session.thread.create({
  metadata: { source: 'migration' },
});
```
