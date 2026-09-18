---
'@mastra/core': patch
---

Fixed active goals being reported to the agent as cancelled, and stopped the goal being duplicated in the model's context on every step.

Two things combined to make an active goal look cancelled. The goal state processor is contributed by a signal provider, so when `inputProcessors` was configured as a function the processor never received the Mastra instance and could not resolve storage. And if a step could not reach storage at all, the goal was projected as having no objective — `status: none` — which the agent reads as "the goal was cancelled" and stops working.

The goal state projection is also append-only, so re-emitting it does not update the objective in context, it duplicates it. The projection was keyed on the goal's progress (`runsUsed`), which advances on every judge pass, so the key never matched the previous projection and the same objective was appended again on each attempt — three copies of the objective were in context by the third attempt. It is now keyed on the objective itself, so an objective that is already in the window is not added again. The projection also no longer carries `runsUsed` and `maxRuns`: an append-only snapshot cannot keep a per-attempt counter current, and the goal judge reminder already reports the live attempt count on every evaluation.

The processor now keeps the last known objective when storage is unavailable instead of retracting it, and the Mastra instance is propagated to processors contributed by signal providers.
