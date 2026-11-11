---
'@mastra/core': patch
---

Fixed evented workflows running a step once per instance when several instances start at the same time (#28712).

While an instance is running a step of an evented run, `restart()` on that run now throws `WORKFLOW_RESTART_RUN_OWNED`, and the boot-time restart tries the run again later. This also applies while a step of a nested workflow is running, and lasts until `MASTRA_AGENT_THREAD_LEASE_TTL_MS` (15 seconds by default) after the run's last step.

Concurrent `restart()` calls on one run now restart it once. A step delivered twice now runs once, unless the instance running it stops. In that case another instance runs the step once that time has passed. Workflows with `autoRestartActiveRuns: false` behave as before.
