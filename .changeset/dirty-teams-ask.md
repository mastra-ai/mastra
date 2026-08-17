---
'@mastra/client-js': patch
---

`session.state()` now accepts a `threadId`, so reopening a chat can load the durable task list for that specific thread.

```ts
const state = await session.state({ threadId: 'thread-123' });
```
