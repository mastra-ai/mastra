---
'@mastra/core': patch
---

Added a coalesced display state subscription API for Harness.

This helps UI clients render fewer updates while still receiving the latest state. The example below renders the initial state, then subscribes to coalesced updates with the default `windowMs` and `maxWaitMs` timing options.

```ts
render(harness.getDisplayState());

const unsubscribe = harness.subscribeDisplayState(render, {
  windowMs: 250,
  maxWaitMs: 500,
});
```
