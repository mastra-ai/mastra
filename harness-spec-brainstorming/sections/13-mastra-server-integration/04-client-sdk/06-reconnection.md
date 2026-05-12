### 13.4f Reconnection

**Reconnection** is automatic. If the SSE stream drops, the client reconnects
with `Last-Event-ID` and follows the §10.5 replay contract. If the server
returns `412 Precondition Failed` under those replay-gap rules, the client
transparently re-fetches `SessionSnapshot` via `GET /sessions/:sessionId`,
applies the returned `displayState: HarnessDisplayStateSnapshotV1` as a
point-in-time render input, follows the snapshot's message cursor through the
thread message route when more persisted history is needed, checks every
unresolved operation through the §13.2 / §13.3 result lookup routes, settles
terminal responses under §4.2, and then resumes from the new tail for operations
that remain pending. Message, activity, subagent-inbox, and diagnostics cursors
are ordinary §4.4 navigation tokens: the SDK may cache them for the current
view, but it must not treat them as read-state, SSE replay cursors, or proof
that no compacted source rows were missed.
