---
'@mastra/core': patch
---

Fixed AbortSignal not propagating from parent workflows to nested sub-workflows in the evented workflow engine.

Previously, canceling a parent workflow did not stop nested sub-workflows, causing them to continue running and consuming resources after the parent was canceled.

Now, when you cancel a parent workflow, all nested sub-workflows are automatically canceled as well, ensuring clean termination of the entire workflow tree.

**Example:**

```typescript
const parentWorkflow = createWorkflow({ id: 'parent-workflow' })
  .then(someStep)
  .then(nestedChildWorkflow)
  .commit();

const run = await parentWorkflow.createRun();
const resultPromise = run.start({ inputData: { value: 5 } });

// Cancel the parent workflow - nested workflows will also be canceled
await run.cancel();
// or use: run.abortController.abort();

const result = await resultPromise;
// result.status === 'canceled'
// All nested child workflows are also canceled
```

Related to #11063
