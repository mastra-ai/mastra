---
'@mastra/core': minor
'mastracode': patch
---

Added harness events for session lifecycle updates, mode changes, model changes, and cloned threads.

Users can now subscribe to harness events or provide an onEvent handler when creating a harness.

**Example**

```ts
const harness = new Harness({
  modes,
  onEvent: event => {
    console.log(event.type);
  },
});

const unsubscribe = harness.subscribe(event => {
  console.log(event.id, event.type);
});
```
