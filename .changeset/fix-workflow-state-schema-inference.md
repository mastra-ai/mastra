---
'@mastra/core': patch
---

Fixed `createWorkflow` to correctly infer `TState` from `stateSchema`, so `state` is properly typed in `dowhile`/`dountil` conditions instead of being typed as `unknown`.

**Before:** Passing `stateSchema` to `createWorkflow` did not propagate the type to loop conditions.

```ts
const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  stateSchema: z.object({ idx: z.number().default(0) }),
});

workflow.dowhile(myStep, async ({ state }) => {
  return state.idx < 5; // Error: 'state' is of type 'unknown'
});
```

**After:** `state` is correctly typed as the inferred schema type.

```ts
workflow.dowhile(myStep, async ({ state }) => {
  return state.idx < 5; // state.idx is typed as number ✓
});
```
