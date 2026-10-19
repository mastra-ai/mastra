---
'@mastra/core': patch
---

Fixed `stopWhen` on durable agents (`DurableAgent`, evented and Inngest) receiving steps without `content`. Predicates such as `steps.at(-1)?.content.some(...)` used to throw and end the run with a stream error. They now see the same step content that `stream.steps` reports.
