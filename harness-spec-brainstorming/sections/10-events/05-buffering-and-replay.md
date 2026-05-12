### 10.5 Buffering and replay

Each session keeps a ring buffer of recent events (`sessions.eventBufferSize`,
default 1000; see §9). The buffer feeds two consumers:

- **`session.subscribe(...)` after the fact.** If the session is currently in a
turn when a new subscriber attaches, the subscriber sees future events only — no
automatic backfill. Callers that need to recover from a missed window should use
`session.listMessages(...)` for content and the SSE replay path for live event
continuation.
- **SSE replay over the wire.** The Mastra Server adapter (§13) honours
`Last-Event-ID` on the SSE endpoint. The server replays buffer entries newer
than `Last-Event-ID`, then live-tails. See the replay rules below.

The local `harness.subscribe(...)` control-plane stream is not backed by a
merged replay buffer. A late harness subscriber sees future harness-scoped
events
and future fan-out copies from live sessions only; it does not backfill previous
events from session buffers and cannot reconnect with `Last-Event-ID`.

**Epoch and event IDs.** Each in-memory Session instance has an `epoch` token,
generated fresh whenever the instance is constructed — first hydration,
rehydration after eviction, or hydration after a process restart. Event `id` is
`<epoch>-<seq>`, where `seq` is monotonic within the epoch and resets when the
epoch changes. Two events from different epochs are never comparable as a
sequence, even if they share the same `seq`. Harness-scoped events use the same
`<epoch>-<seq>` shape against the harness's own epoch+sequence.

**Replay rules.** On reconnect with `Last-Event-ID: <epoch>-<seq>`:

- If the epoch matches the current Session instance and `seq` is within the
buffer, the server replays entries newer than the supplied ID and live-tails.
- If the epoch matches but `seq` is older than the buffer's oldest entry, the
buffer has overflowed; the server returns `412 Precondition Failed`.
- If the epoch does not match the current Session instance, the prior epoch's
buffer is gone (eviction or process restart). The server returns
`412 Precondition Failed`.
- If `Last-Event-ID` is malformed (not `<epoch>-<seq>`) or absent, the server
starts the SSE stream from the live tail with no replay.

In every `412` case the client is expected to refetch the session snapshot via
`GET /sessions/:sessionId` and resubscribe. That route returns the
`SessionSnapshot` read model (§5.1): identity, lifecycle, current run
projection, queue item identifiers, session-owned pending inbox items, display
snapshot, goal state, channel binding summary, token usage, the bounded
durable-work summary, and a bounded message window or cursor for the persisted
thread message log. It does not synthesize missed `text_delta`, tool, or channel
events from storage.
Multi-session controllers apply this rule per affected session and rebuild their
view through the §13.4 controller recovery recipe rather than through
cross-session event replay.

**Scope.** The Harness session SSE buffer is in-memory only. On session eviction
or harness shutdown the buffer is dropped along with its epoch — **durable
Harness SSE replay across restarts is not a goal of v1**. This does not describe
Mastra durable-agent pubsub replay
(`../packages/core/src/events/caching-pubsub.ts`), which may use its own
cache-backed replay path. Current cache-backed, topic-indexed, or run-scoped
replay paths may feed
the §10 event adapter internally, but they must not back the v1 session SSE
replay directly because they do not own this section's epoch, `Last-Event-ID`,
overflow, and stale-cursor contract. Harness subscribers must treat this session
event buffer as live process state. The epoch contract makes the "stale ID after
restart or eviction" path deterministic: any `Last-Event-ID` from a previous
epoch is detected at the server and yields `412`, even if a new event happens to
share the same `seq`. Synthesizing replay from message storage or any other
persisted state is explicitly out of scope; SSE replay is best-effort over the
live in-memory ring buffer only. Lifecycle notifications such as
`session_evicted` and `harness_shutdown`, when observed before the buffer
disappears, are still observer events only: they do not imply `closedAt`,
durable replay availability, or operation settlement. Clients that need durable
history beyond a single epoch should use the snapshot's message cursor and
`GET /threads/:threadId/messages` (§13.2) for the persisted message log and
treat the SSE stream as live-only.
