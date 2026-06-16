---
'@mastra/core': minor
---

Removed the coalesced Harness display state subscription API.

**Before**

```ts
const unsubscribe = harness.subscribeDisplayState(displayState => {
  render(displayState);
});
```

**After**

```ts
const unsubscribe = harness.subscribe(event => {
  if (event.type === 'display_state_changed') {
    render(event.displayState);
  }
});

const currentDisplayState = harness.getDisplayState();
```

Use `subscribe()` with `display_state_changed` events and `getDisplayState()` for UI rendering.
