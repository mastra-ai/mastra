---
'@mastra/factory': minor
'@mastra/code-sdk': patch
---

Wake the Factory supervisor after a server restart when work is still open. A restart kills in-flight runs without emitting a run-completion event, so idle worker observation cannot see them and the affected work items stall silently. Factory now enqueues one durable supervisor notification per tenant that still has a work item outside the `done` and `canceled` stages, asking the supervisor to find stalled work and resolve it one item at a time. Repeated restarts inside a 15-minute window collapse into a single wake, and delivery is exactly-once across replicas. Opt out with `supervisor.checkInOnBoot: false` in the Factory rules.
