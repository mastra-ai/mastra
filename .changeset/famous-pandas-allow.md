---
'@mastra/client-js': patch
'@mastra/core': patch
---

Removes the deprecated `threadId` and `resourceId` options from `AgentExecutionOptions`, these have been deprecated for months. These were deprecated in favour of the `memory` option

Before:

```ts
await agent.stream('Hello', {
  threadId: 'thread-123',
  resourceId: 'user-456',
});
```

After:

```ts
await agent.stream('Hello', {
  memory: {
    thread: 'thread-123',
    resource: 'user-456',
  },
});
```
