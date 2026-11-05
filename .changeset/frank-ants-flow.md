---
'@mastra/core': minor
---

Evented workflows from `@mastra/core/workflows/evented` now accept the experimental `storageVersion: 2` option. Before, setting it on an evented workflow threw. On version 2, each step's message carries only the previous step's result and the state changes, and the engine loads the rest from storage. In an `EventedAgent` run with 16 tool calls, published messages fell from 86 MB to 11.4 MB and storage writes from 60.6 MB to 2.6 MB.

```ts
const workflow = createEventedWorkflow({
  id: 'my-workflow',
  inputSchema,
  outputSchema,
  options: { storageVersion: 2 },
});
```

On both storage versions, a nested run's messages no longer carry a copy of the parent run's step graph. On version 1, this took the same agent run from 120 MB to 86 MB of published messages.
