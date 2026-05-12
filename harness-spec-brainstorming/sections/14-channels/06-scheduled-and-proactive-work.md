### 14.6 Scheduled and Proactive Work

Process-local `harness.onInterval(...)` is not the primitive for durable channel
autonomy. Restart-safe scheduled or proactive channel work first creates or
claims a `HarnessWakeupItem` (§5.1, §5.2), then admits the user-visible work
through `session.queue(...)` with
`requestContext.channel.origin = 'scheduled' | 'proactive'`, and finally relies
on the same outbox for delivery. The wakeup row is a source-specific handoff and
recovery ledger, not a general scheduler, workflow engine, operator repair
surface, or second conversation state machine. Channel-origin
scheduled/proactive work requires an active `ChannelBinding` before queue
admission; the worker validates the snapshotted `bindingId` and
`bindingGeneration`, copies the binding's target identifiers into
`requestContext.channel`, and fails closed instead of inventing platform IDs. If
the binding was replaced, closed, deleted, or marked `undeliverable`, the worker
does not retarget automatically: it follows an explicit operator/product
migration policy, queues non-channel work only when the wakeup policy permits
abandoning channel delivery, or marks the wakeup `skipped`, retryable `failed`,
or `dead`. Proactive outreach to a platform destination that has no active
binding/conversation yet is outside Harness v1 channel-origin delivery; products
must provision a binding/target first or run the work as non-channel automation.
Non-channel scheduled/proactive work may use a simpler schedule-fire path only
when it accepts best-effort or application-owned durability; if it requires
restart-safe Harness admission through `session.queue(...)`, it uses the same
`HarnessWakeupItem` boundary without `requestContext.channel`. The queued item's
`admissionId` is the wakeup `admissionId`, derived from the wakeup id, schedule
fire id, or other stable autonomy key, so duplicate scheduler fires cannot
append duplicate turns.

Mastra already has workflow scheduling with storage-backed due-schedule claiming
and pubsub workflow start
(`packages/core/src/workflows/scheduler/scheduler.ts`). Harness channel specs
should build on that shape, but the scheduler alone is not end-to-end durable
channel delivery: the workflow or background task must still resolve a
`ChannelBinding`, queue the session work with idempotency, and rely on the
outbox for outbound effects. A claim-then-publish scheduler that advances
`nextFireAt` before the pubsub publish is durably represented can de-dupe due
fires but can still lose a channel wakeup if the process crashes before
publication. Durable channel autonomy therefore creates or loads the
`HarnessWakeupItem` at the scheduler handoff, before the scheduled occurrence
can be lost: either in the same transaction or conditional write as the due-fire
claim, or through a separate durable schedule-fire claim that remains
recoverable until it creates or loads the wakeup. A workflow/background task
that is merely published by the current workflow-only scheduler and only then
creates or queues work is a best-effort accelerator, not the recovery boundary.
Recovery claims wakeups whose publication never happened, whose workflow start
was not consumed, or whose worker crashed before `session.queue(...)` committed.
Missed schedule fires default to coalescing: when a scheduler discovers several
missed occurrences for the same `(harnessName, sourceId)` and the application
did not opt into backfill, it creates one due wakeup for the newest fire and
records `missedCount`; applications that require backfill create one wakeup per
fire id, and applications that intentionally skip a fire mark the row `skipped`
with a terminal reason.

Background tasks are execution machinery, not the public channel-autonomy
durability boundary. A background task row is sufficient only when the runtime
can reconstruct both the executor and completion path from persisted metadata
after restart: stable §9 background-task executor and completion-policy ids
(tool-kind executors in v1), serialized request context or channel
binding/workspace intent when needed, the delivery projection policy, and
fail-closed behavior when a referenced runtime component is unavailable. Current
closure-backed `TaskContext` tasks do not meet that bar by themselves. If
completion depends on a live stream controller, message list, save queue, SDK
thread, provider request, or other process-local closure, the task must run
behind a Harness-owned wakeup/work row that remains retryable. A background task
completion hook must not post directly to the platform; it records durable
Harness/session state or enqueues outbox-producing work.

If the current scheduler only targets workflows, Harness autonomy is expressed
as an application-owned wakeup writer that may use workflow/background execution
after the wakeup row exists, or the scheduler target model is extended
explicitly. Any workflow or agent wrapper used in this path must preserve
persisted `requestContext` through `start`, `startAsync`, and resume boundaries:
it loads the run's persisted context from the durable-agent run-state authority
and forwards it into the wrapped workflow start API just as the base durable
path does for `Workflow.start(...)`. A wrapper that drops the persisted context
before reaching the workflow start API is not valid for trusted channel-origin
policy and must be repaired before it is used on a channel-origin path.
