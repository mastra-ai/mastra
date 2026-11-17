---
'@mastra/core': minor
---

Added `updateState` to workflow steps, workflow tools, `.map()` functions, loop and branch conditions, and sleep functions. It merges the top-level keys it's given into the workflow state, validates the merged state against the step's `stateSchema`, and leaves keys it wasn't given alone, including changes parallel steps made. A key set to `undefined` is removed.

`setState` keeps its existing contract: pass the full state, the value is validated on its own, and a second call in the same step replaces the first.

```ts
// Before: copy the whole state so the other keys survive
await setState({ ...state, count: state.count + 1 });

// After: pass only the keys that change
await updateState({ count: state.count + 1 });
```
