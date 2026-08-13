---
'@mastra/core': patch
---

Fixed agent streams discarding already-streamed assistant text on abort. Pass `persistPartialOnAbort: true` to save non-empty partial output to memory when a stream is cancelled (Fixes #17510).

**Example**

```ts
const stream = await agent.stream('Hello', {
  memory: { thread: 'my-thread', resource: 'user-123' },
  persistPartialOnAbort: true,
});
```
