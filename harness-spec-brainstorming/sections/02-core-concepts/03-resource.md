### 2.3 Resource

A `resourceId` represents a tenant — usually a user or a logical owner. **Threads and sessions are both single-tenant**: every thread has exactly one `resourceId`, and every session inherits its thread's `resourceId`. This is a hard isolation boundary, not a hint.

The lookup key everywhere is `(resourceId, threadId)` for threads and `(resourceId, sessionId)` for sessions. Storage primitives may accept just `threadId` / `sessionId` for harness-internal operations (cascade-delete, migrations, admin tools), but the harness layer always cross-checks `resourceId` before returning to a caller. A mismatch is treated identically to "does not exist" — the harness throws `HarnessSessionNotFoundError` for sessions and returns `null` (or `404` over the wire) for threads. **Cross-tenant access never returns 403 — it returns 404, so existence isn't leaked.**

Concretely:

- `harness.session({ threadId, resourceId })` — if the thread exists but belongs to a different resource, behaves as if the thread does not exist (creates a fresh thread + session under the caller's `resourceId`).
- `harness.session({ sessionId })` — allowed for single-tenant deployments. The harness looks up the record and returns it. **Recommended:** pass `{ sessionId, resourceId }` whenever the caller knows the resource. If `resourceId` is supplied and the stored record's `resourceId` doesn't match, throws `HarnessSessionNotFoundError`. The wire protocol always passes `resourceId` from auth (§13.2), so server callers always get the cross-check.
- `harness.threads.get({ threadId, resourceId })` — `null` for cross-tenant access.
- Subagent sessions inherit the parent's `resourceId` and are addressable only under that resource.

In server deployments, `resourceId` is resolved server-side from auth context. Clients never send it themselves (see §13).
