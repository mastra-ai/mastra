---
'@mastra/pg': minor
---

Added native span fields and typed stop-reason detail to PostgreSQL storage, including additive schema upgrades.

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

Added workflow span checkpoint storage for durable tracing handoff. Checkpoint-capable stores merge concurrent siblings independently, preserve completed snapshots, and retain checkpoints across full workflow snapshot writes. Inngest uses these checkpoints for cancellation handoff; evented workers use them for root identity and completion.

Preserve the active execution-root pointer alongside span checkpoints across stale full-snapshot writes. Resume lineage can point to an older or external span without redirecting the active execution.
