---
'@mastra/core': minor
'@mastra/memory': minor
'@mastra/server': minor
'@mastra/client-js': minor
---

Add thread ownership transfer (resourceId reassignment).

You can now transfer an existing thread to a different resource, reassigning both the thread and its messages to the new `resourceId` while preserving the thread's original `createdAt` timestamp. This supports scenarios like moving a private thread into a shared workspace without the previous upsert workaround.

- `@mastra/core` / `@mastra/memory`: new `Memory.updateThreadResourceId({ threadId, resourceId })` method, backed by a default `MemoryStorage.updateThreadResourceId` implementation.
- `@mastra/server`: new `POST /memory/threads/:threadId/transfer` route. The endpoint is restricted to privileged, non-resource-scoped callers and rejects requests made with a resolved resource scope.
- `@mastra/client-js`: new `MemoryThread.transfer({ resourceId })` method.
