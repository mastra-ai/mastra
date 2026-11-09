---
'@mastra/core': minor
---

Added `getState()` to workflow steps, tools that run inside workflows, `.map()` functions, loop and branch conditions, and sleep functions. It resolves to the current workflow state, including the step's own `setState` changes. Pass top-level keys to get only those keys.

Reading `state` in a run stored with the experimental `storageVersion: 2` option now throws, on both the default and evented engines. Use `getState()` instead:

```ts
// Before
execute: async ({ state }) => state.count;

// After
execute: async ({ getState }) => (await getState(['count'])).count;
```
