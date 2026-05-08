### 2.2 Thread vs Session

| | Thread | Session |
|---|---|---|
| What | Persistent message log | Per-conversation runtime + persisted runtime state |
| Storage | `MastraStorage.harness` (threads + messages) | `MastraStorage.harness` (session records) |
| Lifetime | Until explicitly deleted | Until explicitly closed; survives process restarts |
| Cardinality | One per conversation | One or more per thread, **all belonging to the same resource** |
| In memory? | Loaded on demand | Hydrated on demand; auto-evicted when idle |

A thread is the message history. A session is the live conversation that operates on it. Closing a session does not delete the thread.

The "one or more sessions per thread" cardinality refers to **the same user** holding multiple sessions on the same thread — typical reasons:

- The same human on a laptop and a phone, both attached to the conversation. Each device gets its own `Session` instance (potentially with its own deterministic `sessionId` derived from `(userId, deviceId)`); both read and write the same thread.
- A long-running conversation that gets rehydrated by a different server process on each request. Different `Session` instances over time, same thread, same resource.
- Operator tooling resuming a thread programmatically alongside the original user's live session.

Threads are **not** shared across resources in v1. A thread is permanently bound to the `resourceId` it was created under, and it is only addressable by that resource. Cross-tenant shared / collaborative threads are intentionally out of scope (see §11.5 on what's not in v1).
