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

A restart over a lease that lapsed now logs a warning and doubles the lease, up to 8 times the base. Doubling needs a storage adapter that reports when the lease last changed (in-memory, `@mastra/pg` and `@mastra/libsql` today); other adapters restart with the base length. A process that went a whole lease without renewing logs one warning per stall, found by its next renewal or when the run ends. Moving blocking work off the event loop is still the better fix: a longer lease also delays the recovery of an instance that crashed. See [steps that block the event loop](https://mastra.ai/docs/workflows/overview#steps-that-block-the-event-loop).
