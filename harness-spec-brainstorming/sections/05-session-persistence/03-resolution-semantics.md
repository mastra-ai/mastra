### 5.3 Resolution semantics

The `harness.session(...)` resolver runs find-in-memory → find-in-storage → create:

| Input | Live in memory? | Record in storage? | Result |
|---|---|---|---|
| `{ sessionId }` | yes | n/a | return live instance |
| `{ sessionId }` | no | yes (active) | hydrate record, return |
| `{ sessionId }` | no | yes (closed) | throw `HarnessSessionClosedError` |
| `{ sessionId }` | no | no | throw `HarnessSessionNotFoundError` |
| `{ sessionId, resourceId }` | yes, `resourceId` matches | n/a | return live instance |
| `{ sessionId, resourceId }` | yes, `resourceId` mismatches | n/a | throw `HarnessSessionNotFoundError` |
| `{ sessionId, resourceId }` | no | yes, `resourceId` matches, active | hydrate, return |
| `{ sessionId, resourceId }` | no | yes, `resourceId` matches, closed | throw `HarnessSessionClosedError` |
| `{ sessionId, resourceId }` | no | yes, `resourceId` mismatches | throw `HarnessSessionNotFoundError` (do not leak existence) |
| `{ sessionId, resourceId }` | no | no | throw `HarnessSessionNotFoundError` |
| `{ threadId, resourceId }` | yes | n/a | return live instance |
| `{ threadId, resourceId }` | no | active record exists, thread `resourceId` matches | hydrate record, return |
| `{ threadId, resourceId }` | no | only closed record(s) exist for matching resource | create a **fresh** record + return (closed records do not block reuse of the thread) |
| `{ threadId, resourceId }` | no | thread exists but belongs to a **different** resource | treat as "thread does not exist" — create a fresh thread + fresh session under the caller's `resourceId` (do not leak the existing thread) |
| `{ threadId, resourceId }` | no | no | create record + thread (if missing), return |
| `{ threadId: { fresh: true }, resourceId }` | n/a | n/a | always create a fresh thread + fresh session |
| `{ resourceId }` | n/a | active record exists | hydrate most-recent active for that resource, return |
| `{ resourceId }` | n/a | only closed records exist for that resource | create fresh thread + fresh session |
| `{ resourceId }` | n/a | no | create fresh thread + fresh session |

The thread-and-resource lookup deliberately ignores closed records. A common flow — finish a session, close it, then start a new one on the same thread — must produce a fresh active session. Storage adapters enforce this in `loadSessionByThread(...)` (see §5.2): the method returns `null` when only closed records match, even if a closed record exists. Closed records are still reachable through `loadSession({ sessionId })` and `listSessions({ includeClosed: true })` for history and audit views.

`{ sessionId, threadId, resourceId }` (all three) is the multi-tenant-server pattern: caller computes a deterministic session ID from `(user, thread)` and asks for that session. Resolves to the live instance, hydrates from storage if needed (active records only), or creates a fresh record with that ID bound to the thread. A closed record at that ID still throws `HarnessSessionClosedError` — deterministic IDs and closure are mutually exclusive (the caller picks a new ID or rotates the thread).
