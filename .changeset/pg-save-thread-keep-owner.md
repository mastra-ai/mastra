---
'@mastra/pg': patch
---

Fixed `saveThread` so that saving an existing thread id no longer moves the thread to another resource or overwrites its creation date. Its messages could previously be left on the old resource.

Re-saving a thread with the same `resourceId` still updates its title, metadata and `updatedAt`. It keeps the original `createdAt` and returns the stored row. Re-saving with a different `resourceId` now throws a `MastraError` with category `USER`. To move a thread and its messages to another resource, use `updateThreadResourceId`:

```ts
await memory.updateThreadResourceId({ threadId: 'thread-1', resourceId: 'user-2' });
```
