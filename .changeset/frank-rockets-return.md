---
'@mastra/observability': minor
---

Added execution outcomes and stop-reason details to span lifecycle methods and both Mastra exporters. Completed spans retain their results during cleanup, and recovered executions clear earlier stop details.

Custom spans can record how they ended:

```ts
span.end({ outcome: 'limit', stopReason: 'max_steps', stopReasonContext: { maxSteps: 5 } });

// End the span and its open descendants after a caller cancels
span.end({ endTree: true, outcome: 'abort', stopReason: 'caller_cancelled' });
```
