---
'@mastra/core': patch
---

Fixed durable and evented agents using memory that grew quadratically with the number of steps in a turn. Each step-finish chunk used to carry every response message produced so far, so a 40-step turn with large tool outputs (for example computer-use screenshots) could reach hundreds of megabytes on a serializing pubsub such as `@mastra/redis-streams`. Step-finish chunks now carry only the messages that changed since the previous step. `onStepFinish`, `output.steps`, and `onFinish` still report the full response messages for each step.

An `observe(runId, { offset })` call that starts after the run's first step-finish only receives the messages from the first step-finish it sees onward. Earlier messages are not included in its step and response messages; observe from offset 0 to get the full list.

Fixes #27475.
