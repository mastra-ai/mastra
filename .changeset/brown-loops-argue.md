---
'@mastra/duckdb': minor
---

Added native span fields and typed stop-reason detail to DuckDB storage. Successful completion clears provisional failure context.

Read the supplied execution result from stored spans:

```ts
const result = await observabilityStore.getSpan({ traceId, spanId });
console.log(result?.span.outcome, result?.span.stopReasonContext);
```

Trace and branch lists can filter the execution's native outcome and stop reason:

```ts
const limited = await observabilityStore.listBranches({
  filters: { outcome: 'limit', stopReason: 'context_window_exceeded' },
});
```

Lightweight trace lists and timelines now retain native outcome and stop reason. Full causal context remains available from `getSpan`.

Advanced trace, related-span, thread, and span queries support native outcome and stop-reason predicates and value suggestions. Advanced span responses retain both fields independently of legacy status.
