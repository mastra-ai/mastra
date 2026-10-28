---
'@mastra/core': minor
---

Added native execution outcomes and typed stop-reason context to agents, model calls, tools, and workflows. Adopted producers report ongoing execution as `null`; unavailable producer values remain unavailable. Outcome and stop reason are independently filterable, while context preserves provider, guardrail, observer, and serialized signal details.

```ts
span.end({ outcome: 'abort', stopReason: 'caller_cancelled', stopReasonContext: null });
```

Distinguished successful completion on the final allowed step from `max_steps` preventing continuation, caller cancellation from deadlines, and runtime errors from model errors. Recovered retries preserve successful parent outcomes; rejected attempts and completed provider calls retain their own results. Observer interruptions preserve the observer's separate cause.

Added outcomes for workflow roots, steps, nested invocations, parallel/conditional blocks, loops, predicate evaluations, and waits. Suspended and resumed segments have separate identities. Cancellation preserves completed peers, and failed predicates retain their cause when existing fallback behavior recovers. Nested foreach resume resolves the selected child's run.

Added workflow span checkpoints for in-memory, LibSQL, and PostgreSQL storage. Evented workers can restore the caller's root and complete it after caller loss. Cancellation on a replacement worker closes checkpointed steps, waits, containers, evaluations, and nested children through their original exporter. Pending child snapshots prevent delayed dispatch from reopening canceled runs. This requires persisted snapshots and checkpoint-capable storage; it does not restore timers or transfer active ownership.

Preserved active execution identity separately from resume lineage. Delayed terminal events addressed to an older segment cannot settle the resumed caller when checkpoint identity is available. Guarded terminal writes preserve completed workflow state, and late span starts cannot reopen completed in-memory records. Export delivery remains replayable rather than exactly-once.
