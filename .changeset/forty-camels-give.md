---
'@mastra/core': minor
---

Added native execution outcomes and typed stop-reason context to agents, model calls, tools, and workflows. Adopted producers report ongoing execution as `null`; unavailable producer values remain unavailable. The shared exporter record contract preserves outcome, stop reason, and typed provider, guardrail, observer, and serialized signal detail. Storage implementations and query support are separate work.

```ts
span.end({ outcome: 'abort', stopReason: 'caller_cancelled', stopReasonContext: null });
```

Distinguished successful completion on the final allowed step from `max_steps` preventing continuation, caller cancellation from deadlines, and runtime errors from model errors. Recovered retries preserve successful parent outcomes; rejected attempts and completed provider calls retain their own results. Observer interruptions preserve the observer's separate cause.

Added outcomes for workflow roots, steps, nested invocations, parallel/conditional blocks, loops, predicate evaluations, and waits. Suspended and resumed segments have separate identities. Cancellation preserves completed peers, and failed predicates retain their cause when existing fallback behavior recovers.

Kept semantic outcomes separate from tripwire mechanisms. Guardrails report `blocked / guardrail`; tripwire details are retained under `stopReasonContext.tripwire`. Terminal results select context by `stopReason`, without repeating the machine reason inside the context.
