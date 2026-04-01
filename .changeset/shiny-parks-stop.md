---
'@mastra/memory': minor
---

Added `loadUnobservedMessages({ threadId, resourceId? })` as a public method on `ObservationalMemory`.

This lets external consumers (e.g. the Mastra gateway proxy) load previously-stored messages that haven't been observed yet, without having to reimplement the internal storage query and part-level filtering logic. The method fetches the OM record, queries storage for messages after the `lastObservedAt` cursor, and applies part-level filtering so partially-observed messages only return their unobserved parts.

```ts
const unobserved = await om.loadUnobservedMessages({
  threadId: 'thread-123',
  resourceId: 'user-456',
});
```
