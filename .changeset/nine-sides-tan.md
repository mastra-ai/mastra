---
'@mastra/temporal': minor
---

**Breaking:** Steps now check their input against `inputSchema`, and their request context against `requestContextSchema`, before they run, as on Mastra's built-in workflow engine. Before, a step ran on any input, so a run could return `success` with a wrong value. A mismatch now fails the step without retries and the run returns `status: 'failed'`. Steps also get the parsed input, with schema defaults and transforms applied. Fixes [#28308](https://github.com/mastra-ai/mastra/issues/28308).

To keep the old behavior for a workflow, turn the check off:

```ts
createWorkflow({ id: 'my-workflow', options: { validateInputs: false } });
```

Check these before upgrading:

- The Worker build reads `options.validateInputs`, so it must be a boolean literal in an inline `options` object. The build fails otherwise:

  ```ts
  // Before
  createWorkflow({ id: 'my-workflow', options: sharedOptions });
  // After
  createWorkflow({ id: 'my-workflow', options: { validateInputs: false, tracingPolicy: sharedOptions.tracingPolicy } });
  ```

- Step input passes through Temporal's data converter, which turns a `Date` into a string. Use `z.coerce.date()` instead of `z.date()` in a step's `inputSchema`.
- Object schemas drop keys they don't declare. A step that reads an undeclared key from `inputData` now gets `undefined`. Add the key to its `inputSchema`.
- After a `.parallel()` that contains a nested workflow, the next step receives the nested workflow's output under its Temporal workflow type, for example `innerWorkflow` for id `inner`. Write that step's `inputSchema` with that key.
- Steps scheduled after the Worker upgrade are checked, including steps of runs that started before it.
