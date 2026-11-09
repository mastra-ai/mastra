---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/mcp': patch
---

Storage version 2 workflow results no longer load every step result into memory. With `storageVersion: 2`, `start()`, `resume()`, `restart()` and `timeTravel()` return `status`, `result`, `error`, `suspended` and the other result fields right away, and `steps` is an async function that reads the full step history from storage when you call it. Version 1 results are unchanged, and `steps` is still a record.

```ts
const run = await workflow.createRun();
const result = await run.start({ inputData });

console.log(result.status, result.result); // available right away
const steps = await result.steps(); // reads the step results from storage
```

Calling `steps()` more than once, or at the same time, reads storage only once. `onFinish` and `onError` callbacks receive the same function and can await it. If the run moved on after the result was returned, for example because it was resumed or deleted, `steps()` throws `WORKFLOW_STORAGE_V2_STEPS_STALE` instead of returning newer results. The workflow HTTP routes and MCP workflow tools still return `steps` as an object.
