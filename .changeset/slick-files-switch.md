---
'@mastra/core': minor
---

Workflows can now set `pruneSnapshot` together with the experimental `storageVersion: 2` option. Before, creating such a workflow threw. On version 2 the hook runs once, when the run finishes (a redelivered finish event doesn't prune the stored run again; concurrent duplicate deliveries can each invoke the hook with the same unpruned input, so keep it side-effect-free), and only for a workflow that sets `storageVersion: 2` itself: a nested run that inherits version 2 from its parent keeps its step results unpruned. The hook receives every step result. The default engine writes back only the results it changes; the evented engine replaces the stored run with the pruned one. Suspended runs aren't pruned, because their later steps read the earlier results from storage. The run's result keeps the unpruned step results. Replace step results rather than removing them: on the default engine, a step result the hook leaves out stays stored.

```ts
const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema,
  outputSchema,
  options: {
    storageVersion: 2,
    // Replace the large output of the `download` step once the run finishes
    pruneSnapshot: ({ snapshot }) => ({
      ...snapshot,
      context: {
        ...snapshot.context,
        download: { ...snapshot.context.download, output: { pruned: true } },
      },
    }),
  },
});
```
