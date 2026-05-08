### 5.5 Lifecycle

A session record is in one of three states:

- **Active (resumable).** `closedAt: undefined`. May or may not be live in memory.
- **Closed.** `closedAt: <timestamp>`. Cannot be hydrated. `harness.session({ sessionId })` throws `HarnessSessionClosedError`.
- **Deleted.** Record removed from storage.

Transitions:

- `session.close()` (or `harness.closeSession({ sessionId })` when you only have the ID) — flushes, evicts from memory, sets `closedAt`. Final.
- `harness.threads.delete({ threadId })` — cascades: closes and deletes all sessions bound to that thread.
- Idle eviction — moves between "active in memory" and "active in storage only," never touches `closedAt`.

**Closed records and thread reuse.** A thread can outlive any single session that ran on it. After `session.close()` the thread is still a valid target for a new session: `harness.session({ threadId, resourceId })` ignores the closed record and creates a fresh active session bound to the same `threadId` (see §5.3). Closed records remain in storage as history — addressable by `harness.session({ sessionId })` (which throws `HarnessSessionClosedError`), surfaced by `harness.listSessions({ resourceId, includeClosed: true })`, and removed only by an explicit `harness.deleteSession(...)` or by `harness.threads.delete(...)` cascading.

Detach (proactively flush + drop without closing) is not exposed in v1. It happens implicitly via eviction. If real callers want explicit control later, we add `harness.detachSession({ sessionId })` in a minor.
