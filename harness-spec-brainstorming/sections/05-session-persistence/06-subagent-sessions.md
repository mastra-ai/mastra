### 5.6 Subagent sessions

A subagent session is a normal `SessionRecord` with `parentSessionId` set. It persists like any other session. This means:

- Subagent state survives restarts the same way parent state does.
- Walking `parentSessionId` rebuilds the subagent tree without needing in-memory state.
- Subagent sessions are visible in `listSessions(...)` (filterable by `parentSessionId` if needed; not in v1).

Subagent depth (§8) is computed from the chain of `parentSessionId` records, not from a runtime counter — so the cap holds across restarts.
