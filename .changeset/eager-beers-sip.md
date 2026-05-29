---
'@mastra/core': minor
'mastracode': patch
---

Added harness events for session lifecycle updates, mode changes, model changes, and cloned threads.

Users can now subscribe to harness events to observe harness activity.

**Example**

```ts
const unsubscribe = harness.subscribe(event => {
  console.log(event.id, event.type);
});
```
