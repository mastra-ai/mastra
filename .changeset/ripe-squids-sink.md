---
'@mastra/core': patch
---

Added `createdAt` timestamps to message parts in message history.

Message parts now keep their own creation timestamps so downstream code can preserve part-level timing instead of relying only on the parent message timestamp.

After:
```ts
{ type: 'text', text: 'hello', createdAt: 1712534400000 }
```
