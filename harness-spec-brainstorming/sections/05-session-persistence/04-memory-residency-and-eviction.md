### 5.4 Memory residency and eviction

The Harness keeps a configurable cap on live sessions to bound memory. When the cap is exceeded or a session has been idle past the configured timeout:

1. The in-memory `Session` flushes any dirty state to storage.
2. The instance is dropped from the live map.
3. The record stays in storage with `closedAt: undefined`.
4. The next `harness.session({ sessionId })` call re-hydrates transparently.

**Pending interrupts pin the session in memory.** A session is *not* eligible for idle-timeout eviction while any of `pendingApproval`, `pendingSuspension`, `pendingQuestion`, or `pendingPlan` is set. Evicting a session that is parked on a human-in-the-loop prompt would silently kill an active stream the moment the user gets distracted. The pin lifts as soon as the prompt is answered (or the session is explicitly closed). Note that pressure-based eviction via `sessions.maxLive` still applies — pinning only protects against time-based idle eviction.

Eviction is invisible to callers. They always get a working `Session` from `harness.session(...)`; whether it was already in memory or just hydrated is an implementation detail.

Configuration knobs (see §9):
- `sessions.maxLive` — cap on hydrated sessions (default `Infinity` — no cap; opt in to a finite cap if you need eviction-by-pressure).
- `sessions.idleTimeoutMs` — auto-evict after this period of no activity (default `2 hours`). The check is skipped while a session has a pending approval/suspension/question/plan.
- `sessions.flushDebounceMs` — debounce window for writing dirty state (default `500ms`).
