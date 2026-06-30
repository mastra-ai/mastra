---
'@mastra/core': patch
---

Added regression type tests so `state` stays correctly typed in `dowhile` and `dountil` conditions when a workflow declares a `stateSchema`. The workflow state is inferred from `stateSchema` (matching the typing already available inside `createStep`), and these tests guard against it regressing to `unknown`.

```ts
const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ value: z.number() }),
  stateSchema: z.object({ attempts: z.number() }),
}).dowhile(step, async ({ state }) => {
  // state.attempts is typed as `number`
  return state.attempts < 5;
});
```
