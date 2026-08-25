---
'@mastra/core': patch
---

Prevent stale-build instances from executing scheduled workflow runs.

A scheduled fire carries only a workflow id, so whichever process consumes it resolves the step graph from its *own* registry. During a rollout a not-yet-cycled instance from the previous deploy could therefore run an outdated step graph — skipping steps the current build had added, including gates meant to stop the workflow from running at all — while HTTP runs of the same workflow on the same deployment executed the current graph (#19169).

This is now fenced on both sides:

- Declarative schedule rows record a hash of the workflow's serialized step graph. The scheduler refuses to claim a due fire when its local definition doesn't match the row, leaving the fire for an instance running the current build. If no instance claims it for several consecutive ticks, the scheduler escalates to an error and records a failed trigger rather than stalling silently — it never forces a stale fire through.
- When the claiming process also runs workflow execution, the fire is published `localOnly` so the instance that verified the definition is the instance that runs it. Scheduler-only deployments, where pinning locally would strand the fire, keep publishing to the shared topic.
- Fires that do reach the shared topic now carry the schedule's definition hash, and a consumer whose locally registered workflow hashes differently refuses the run and records a failed trigger instead of executing an outdated graph.

Rows without a hash (legacy or imperatively created schedules) and agent schedules fail open and are unaffected.
