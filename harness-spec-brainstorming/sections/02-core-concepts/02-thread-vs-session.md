### 2.2 Thread vs Session

| | Thread | Session |
|---|---|---|
| What | Persistent message log | Per-conversation runtime + persisted runtime state |
| Storage | `HarnessStorageDomain` (threads + messages) | `HarnessStorageDomain` (session records) |
| Lifetime | Until explicitly deleted | Until explicitly closed; survives process restarts |
| Cardinality | One per conversation inside a Harness namespace | At most one **active** session per `(harnessName, resourceId, threadId)`; closed historical sessions may exist |
| In memory? | Loaded on demand | Hydrated on demand; auto-evicted when idle |

A thread is the message history. A session is the live conversation that
operates on it. Closing a session does not delete the thread.

Harness v1 has exactly one runtime owner for a live conversation inside one
registered Harness: the active `SessionRecord` for
`(harnessName, resourceId, threadId)`. Multiple clients can attach to that same
active session, but they do not create independent active session records for
the same thread in the same Harness namespace. This keeps the mutable runtime —
queue, pending items, `currentRun`, display state, permissions, model/mode, and
workspace handle — behind one lease.

Common cases all route to that same active session:

- The same human on a laptop and a phone, both attached to the conversation.
Each device gets a client connection or `RemoteSession` view over the same
active `sessionId`; both read and write through the same queue and run admission
boundary.
- A long-running conversation rehydrated by a different server process on each
request. Ownership may move after lease release/expiry, but only one process
owns the active session at a time.
- Operator tooling resuming a thread programmatically alongside the original
user's live session. The operator either attaches to the active session under
the normal lease policy or uses explicit operator/admin tooling; it does not
create a second active owner for the same thread.

Multiple session records can still exist for one thread over time inside the
same Harness namespace. Closed records are historical runs of the same
conversation. `harness.session({ threadId, resourceId })` ignores closed records
and returns or creates the one active record for that
`(harnessName, resourceId, threadId)` pair (§5.3).

Threads are **not** shared across resources in v1. A thread is permanently bound
to the `resourceId` it was created under, and it is only addressable by that
resource. Cross-tenant shared / collaborative threads are intentionally out of
scope (see §11.5 on what's not in v1).
