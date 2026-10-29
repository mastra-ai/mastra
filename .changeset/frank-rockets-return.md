---
'@mastra/observability': minor
---

Added execution outcomes and stop-reason details to span lifecycle methods and both Mastra exporters. Mastra-generated stop-reason context contains compact facts and span references; resumed durable agents preserve sampling and privacy settings.

Custom producers retain support for arbitrary outcome strings and context objects, including when spans are rebuilt. Framework-generated context omits raw signals, tripwire payloads, and other unbounded diagnostic data. Model chunk content remains downstream of output processors.

Custom spans can record how they ended:

```ts
span.end({ outcome: 'limit', stopReason: 'max_steps', stopReasonContext: { maxSteps: 5 } });
```

To end a different span and its open descendants after cancellation:

```ts
runSpan.end({ endTree: true, outcome: 'abort', stopReason: 'caller_cancelled' });
```
