---
'@mastra/temporal': minor
---

**Breaking:** Steps now validate their input against `inputSchema` and their request context against `requestContextSchema` before they run, as they do on Mastra's default workflow engine. Before, a step ran on any input, so a run could return `success` with a wrong value. A mismatch now fails the step without retries, and the run returns `status: 'failed'`. Steps also get the parsed input, with schema defaults and transforms applied. Only the steps inside a nested workflow are checked, not its own `inputSchema`. Fixes [#28308](https://github.com/mastra-ai/mastra/issues/28308).

Setting `validateInputs: false` on a workflow skips these checks, along with the workflow input checks in `run.start()`:

```ts
createWorkflow({ id: 'my-workflow', options: { validateInputs: false } });
```

The Worker build reads `validateInputs` from the `createWorkflow()` call. When it can't, for example with `options: sharedOptions`, it prints a warning. Runs started with `run.start()` or `run.startAsync()` still use the workflow's setting. Runs started another way, such as from a Temporal Schedule, check step input.

Check these before upgrading:

- Step input and request context pass through Temporal's data converter, which turns a `Date` into a string. Use `z.coerce.date()` instead of `z.date()` in a step's `inputSchema` and `requestContextSchema`:

  ```ts
  // Before
  inputSchema: z.object({ when: z.date() }),
  // After
  inputSchema: z.object({ when: z.coerce.date() }),
  ```

- Zod `z.object()` schemas drop keys they don't declare. A step that reads an undeclared key from `inputData` now gets `undefined`. Add the key to its `inputSchema`.
- After a `.parallel()` that contains a nested workflow, the next step receives the nested workflow's output under its Temporal workflow type, for example `innerWorkflow` for id `inner`. The default engine uses the id, so a schema written for it can fail on Temporal.
- Steps scheduled after the Worker upgrade are checked, including steps of runs that started before the upgrade.
