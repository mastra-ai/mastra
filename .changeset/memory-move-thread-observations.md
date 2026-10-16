---
'@mastra/memory': patch
---

Moving a thread to another resource with `memory.updateThreadResourceId()` now also moves the thread's observational memory recall entries. Before, recall search under the new resource could not find observations the thread made before the move.

```ts
await memory.updateThreadResourceId({ threadId: 'thread-1', resourceId: 'team-1' });

// Past observations from thread-1 are now found under its new resource
await memory.searchMessages({ query: 'deploy target', resourceId: 'team-1' });
```
