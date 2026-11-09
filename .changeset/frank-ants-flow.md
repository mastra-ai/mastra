---
'@mastra/core': minor
---

Evented workflows from `@mastra/core/workflows/evented` now accept the experimental `storageVersion: 2` option. Before, setting it on an evented workflow threw. On version 2, each step's message carries only the previous step's result and the state changes, and the engine loads the rest from storage. In an `EventedAgent` run with 16 tool calls on `@mastra/pg`, published messages fell from 98 MB to 11 MB, storage writes from 75 MB to 3.1 MB, and run time from 3.9 s to 2.7 s.

```ts
const workflow = createEventedWorkflow({
  id: 'my-workflow',
  inputSchema,
  outputSchema,
  options: { storageVersion: 2 },
});
```

As on the default engine, `steps` on a version 2 run's result is an async function, which `onFinish` and `onError` receive too:

```ts
const result = await run.start({ inputData });
const steps = await result.steps();
```

On both storage versions, a nested run's messages no longer carry a copy of the parent run's step graph. On version 1, this cut the messages an agent run with 16 tool calls publishes by more than a quarter.
