---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'mastra': patch
'create-mastra': patch
---

Add `Run` instance to client-js. `workflow.createRun` returns the `Run` instance which can be used for the different run methods.
With this change, run methods cannot be called directly on workflow instance anymore

```diff
- const result = await workflow.stream({ runId: '123', inputData: { ... } });
+ const run = await workflow.createRun({ runId: '123' });
+ const stream = await run.stream({ inputData: { ... } });
```

