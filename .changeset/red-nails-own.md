---
'@mastra/core': minor
---

Added `startedAt` to the `step-start` stream chunk: the epoch-millisecond instant a step's model inference began, stamped immediately before the provider call on both the regular and the durable engine.

Consumers that measure time to first token previously had to use the time the `step-start` chunk arrived. That does not work on durable agents, which emit `step-start` from inside their chunk loop, after the provider has already produced its first chunk. The gap between `step-start` and the first content chunk was microseconds, so the entire prefill window fell outside every measurement.

```ts
for await (const chunk of stream.fullStream) {
  if (chunk.type === 'step-start') {
    // before: only the arrival time was available, and on a durable agent
    // that instant is already past the model's prefill
    stepStartedAt = Date.now();

    // after: the real inference start travels on the chunk
    stepStartedAt = chunk.payload.startedAt ?? Date.now();
  }
}
```

The field is optional, so a replayed or persisted stream that lacks it can still fall back to arrival time.
