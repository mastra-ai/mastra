### 10.4 Ordering guarantees

- **Per-session FIFO.** Within a single session, events are delivered to every
subscriber in the order the harness emitted them. Subscribers added later still
receive future events in order from the moment they subscribe; they do *not*
automatically replay past events (use the SSE replay path in §10.5 for that).
- **Per-turn coherence.** For a given `runId`: `agent_start` is the first
run-lifecycle event, and `agent_end` (or a run-level `error`) is the terminal
run-lifecycle event. Between them, `text_delta`, `tool_start`/`tool_end`, and
any `subagent_*` events for tools running in that turn appear in the order the
agent layer produced them. Suspension events (`*_required`, `question_pending`)
interleave with text/tool events at the point the suspension occurred and are
followed by either a `tool_end` (after resume) or an `agent_end` (after abort).
- **Per-operation event identity.** Accepted signal-driven `message(...)`
terminal operation events are scoped to the accepted `signalId`:
`message_completed` or `message_failed`. Admitted `queue(...)` terminal
operation events are scoped to `queuedItemId`: `queue_completed` or
`queue_failed`, with `signalId` present only after the queue item has crossed
the agent signal boundary. While the session can project the terminal observer
event, it is emitted after the owning result or recovery path has determined the
operation-scoped terminal status, result, or failure reason. Run/session
lifecycle events such as `agent_end`, run-level `error`, `session_closing`,
`session_closed`, `session_evicted`, and `harness_shutdown` are observer events,
not per-operation settlement boundaries. §3, §4.2, §4.4, §5.7, §13.2 through
§13.4, and §15 own exact promise settlement, stream outer-promise admission
timing, result lookup, retention, tombstone, recovery terminalization, and
verification rules.
- **Cross-session.** No ordering is guaranteed across different sessions. Two
sessions running in parallel emit independently; `harness.subscribe(...)` does
not add a global FIFO or cross-session replay cursor. Fan-out copies preserve
each event's original `id` and epoch space, and harness-scoped events use the
harness epoch space, so subscribers should sort only within one `sessionId` (or
the harness scope for no-session events) and use timestamps or UI-local ordering
for mixed-session rendering.
- **Listener delivery.** Listeners are invoked synchronously in registration
order. Throwing from a listener does not stop other listeners and does not abort
the turn — the exception is caught and logged. Listener errors are intentionally
not re-emitted as events (that would invite feedback loops); subscribers that
need visibility on their own failures should wrap their handler bodies.
- **At-least-once on replay.** During SSE reconnect (§10.5), events that were
already delivered before disconnect may be re-delivered if the client's
`Last-Event-ID` predates them. Subscribers that mutate external state on event
receipt must be idempotent — keying side effects by `event.id` is the standard
pattern.
