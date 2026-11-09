---
'@mastra/core': minor
---

Workflow steps can now pass only the state keys they change to `setState`. The keys are merged into the workflow state, and the merged state is checked against the step's `stateSchema`. Before, the type required the full state, a partial update could fail validation on the default engine, and a second `setState` call in the same step dropped the keys set by the first.

```ts
// Before
await setState({ ...state, count: state.count + 1 });

// After
await setState({ count: state.count + 1 });
```

Copying the whole state still works, but in parallel branches it can overwrite another branch's changes, so pass only the keys that changed.
