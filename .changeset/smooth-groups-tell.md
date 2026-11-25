---
'@mastra/core': minor
---

Added a `leaseTtlMs` option for default-engine workflow runs. A run's lease used to be fixed at 15 seconds, so a step that blocked the event loop for longer let another instance take the run over, and the same step could block there too. Set it on the workflow, or on one run:

```ts
const report = createWorkflow({
  id: 'report',
  inputSchema,
  outputSchema,
  options: { leaseTtlMs: 60_000 },
})

const run = await report.createRun({ leaseTtlMs: 120_000 })
```

A restart over a lease that lapsed now doubles it, up to 8 times the base, and logs a warning. A process whose event loop was blocked long enough to lose its leases logs one warning per stall. Moving blocking work off the event loop is still the better fix: a longer lease also delays the recovery of an instance that crashed. See [steps that block the event loop](https://mastra.ai/docs/workflows/overview#steps-that-block-the-event-loop).
