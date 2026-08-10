---
'@mastra/temporal': minor
---

Added cancellation support for Temporal-backed workflow runs.

```ts
const run = await workflow.createRun();
await run.startAsync({ inputData });
await run.cancel();
```
