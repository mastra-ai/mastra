---
'@mastra/core': patch
---

Fixed active goals being reported to the agent as cancelled, and stopped the goal being repeated in the model's context on every step.

A goal that was still running could be projected as having no objective, which the agent reads as "the goal was cancelled" and stops working on it. That happened when the goal state processor could not reach storage, including when `inputProcessors` was configured as a function and the processor never received the Mastra instance. The last known objective is now kept when storage cannot be read, and the instance is propagated to processors contributed by signal providers. A stale cached pause record could also be trusted over storage; the cached record is now only trusted when it shows the goal active, and storage is re-read otherwise.

The projection is append-only, so re-emitting it duplicated the objective in context instead of updating it. It re-emitted on every attempt because the change it keyed on advanced each time. An objective that is already in context is now left alone.
