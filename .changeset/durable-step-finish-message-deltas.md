---
'@mastra/core': patch
---

Fixed durable and evented agents sending far more stream data than needed on long turns, which could run servers out of memory. Each step-finish chunk used to repeat every response message produced so far. A 40-step turn with large tool outputs (for example computer-use screenshots) could publish hundreds of megabytes through a pubsub that stores events, such as `@mastra/redis-streams`. Step-finish chunks now carry only the messages that changed since the previous step. `onStepFinish`, `output.steps`, and `onFinish` still report the full response messages for each step.

An `observe(runId, { offset })` call that starts after the run's first step-finish only receives the messages from the first step-finish it sees onward. Earlier messages are not included in its step and response messages; observe from offset 0 to get the full list.

Fixes #27475.
