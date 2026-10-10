---
'@mastra/temporal': patch
---

Added support for configuring Temporal activity retries with `init({ retry })`, allowing failing activities to stop after a specified number of attempts while preserving Temporal defaults when omitted.

Previously, activity retries couldn't be configured:

```ts
const { createWorkflow, createStep } = init({ client, taskQueue: 'mastra' });
```

You can now limit generated activities to five total attempts:

```ts
const { createWorkflow, createStep } = init({
  client,
  taskQueue: 'mastra',
  retry: { maximumAttempts: 5, initialInterval: '5 seconds' },
});
```
