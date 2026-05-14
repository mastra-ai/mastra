### 5.4 Memory residency and eviction

The Harness keeps a configurable cap on live sessions to bound memory. When the
cap is exceeded or a session has been idle past the configured timeout:

1. The in-memory `Session` flushes any dirty state to storage.
2. The instance is dropped from the live map.
3. The active record stays in storage with `closedAt: undefined` and no closing
marker.
4. The next `harness.session({ sessionId })` call rehydrates transparently.

**Pending interrupts pin the session in memory.** A session is *not* eligible
for idle-timeout eviction while any of `pendingApproval`, `pendingSuspension`,
`pendingQuestion`, or `pendingPlan` is set. For parent-bound subagent sessions,
a live descendant with one of those pending fields also pins the parent/root
owner subtree, because descendant writes share the parent/root lease (§5.8).
Evicting a session that is parked on a human-in-the-loop prompt would silently
kill an active stream the moment the user gets distracted. The pin lifts as soon
as the prompt is answered (or the session is explicitly closed).

Pressure eviction from `sessions.maxLive` uses least-recently-active order by
`lastActivityAt`, but it only selects unpinned sessions whose dirty state can be
flushed. A session currently mid-flush or in the §5.7 storage-error mode after
repeated flush failures is unflushable for this decision and stays live until
storage recovers or another owner fences it. If hydrating or creating another
session would exceed the cap and every live session is pinned or cannot be
flushed, `harness.session(...)` rejects with `HarnessLiveSessionLimitError`
rather than dropping a pending prompt or pretending the new session exists.

Eviction is transparent to session-API callers. They always get a working
`Session` from `harness.session(...)`; whether it was already in memory or just
hydrated is an implementation detail. Harness observers may still see a
non-terminal `session_evicted` observer event, grouped under the lifecycle-event
union for subscriber convenience (§10.2). It means only that this process
dropped the live cache entry and released the lease. It does not imply
`closingAt`, `closedAt`, durable replay, operation settlement, or that future
turns are rejected after rehydration.

Workspace resolver lifetime follows §2.7's ownership model during eviction.
Per-session live workspace handles are dropped with the evicted `Session`; a
later hydrate resumes durable providers through `SessionRecord.workspace` or
fails closed for lost ephemeral workspaces. Per-resource resolver entries
outlive individual session evictions and are cleaned up only by
`destroyResourceWorkspace(...)` or shutdown.

Configuration knobs (see §9):
- `sessions.maxLive` — cap on hydrated sessions (default `Infinity` — no cap;
opt in to a finite cap if you need eviction-by-pressure).
- `sessions.idleTimeoutMs` — auto-evict after this period of no activity
(default `2 hours`). The check is skipped while a session has a pending
approval/suspension/question/plan.
- `sessions.flushDebounceMs` — debounce window for writing dirty state (default
`500ms`).
