### 2.4 Subagent and Parent

A subagent runs inside a child session. The child session has its own `sessionId`
and its own `threadId`; it does not share the parent's active `(resourceId,
threadId)` key. The child session record carries `parentSessionId` pointing at
the spawner. Parent linkage flows through events (`parentId`, `depth`) so
observers can reconstruct the call tree without holding live object references.

Subagent depth is computed from the chain of `parentSessionId` records, not from a runtime counter. The depth cap (§8) holds across restarts.
