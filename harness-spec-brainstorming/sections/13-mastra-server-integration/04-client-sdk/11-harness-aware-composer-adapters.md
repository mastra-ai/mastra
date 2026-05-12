### 13.4k Harness-Aware Composer Adapters

**Harness-aware composer adapters.** Composer, queue, timeline, pending-card,
and goal-status UI components are projections over `RemoteSafeSession`; they do
not add Session APIs, storage rows, receipt states, event types, timeline routes,
or snapshot fields. Input surfaces follow the §3 concurrency contract:
signal-driven `message(...)` can admit while a session is busy; `queue(...)`
represents future standalone turns; sync structured output, typed skill calls,
and active-run override changes remain fail-fast; closing or closed sessions
reject new admissions through the lifecycle rules in §13.2. Function-valued
`addTools` remains local-only.

Per-item render states, timeline gap markers, composer drafts, and pending-card
labels are client-local projections. They must be derived from `RemoteSafeSession`
reads, snapshots, events, result lookup, and source-specific read models without
creating new public receipt states or re-deriving durable state from stream
ordering. Pending prompt responses still post to the owning session, including
subagent sessions (§13.2). Stop or Cancel controls, when a product exposes them,
are agent/run-layer or process-local controls outside `RemoteSafeSession`; they
are not `session.abort()`, `session.clearQueue()`, or session close, and
interrupted accepted work still follows the operation-terminality rules (§5.7,
§15.2).

Goal UI is the same kind of adapter. It reads committed goal state through
`getGoal()`, mutates goals only through the `RemoteSafeSession` goal methods,
and treats `GoalEvent` values as live projections over the §4.7 lifecycle.
Partial or ambiguous goal events, failed mutations, and SSE `412` gaps require a
`getGoal()` refetch instead of synthesized state. Goal continuations remain
ordinary queued work, clearing a goal does not remove already accepted message or
queue work, and subagent goals remain child-session-local unless a product has
explicitly selected and loaded that child session.
