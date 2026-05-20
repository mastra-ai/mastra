---
'@mastra/core': patch
---

Fixed a scheduler tight loop that polled the storage `mastra_schedules` table ~850 times per second per process when `startWorkers()` was called, even with no scheduled workflows defined. This pegged Postgres CPU in production deployments.

The root cause was the `SchedulerWorker` forwarding an object with explicit `undefined` fields to the `WorkflowScheduler` constructor, where the spread order let `undefined` overwrite the default `tickIntervalMs` of 10000ms. Node's `setInterval` then coerced the undefined interval to ~1ms.

No user-facing API change. Upgrading restores the intended 10s tick interval.
