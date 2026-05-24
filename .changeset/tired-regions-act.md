---
'@mastra/core': minor
---

Added Harness queue backpressure controls. Sessions now support the default `reject` behavior and a `drop-oldest` policy for full durable queues, with `queue_full_dropped` events recording dropped work. Goal continuations now emit durable queue-full evidence instead of being silently discarded.
