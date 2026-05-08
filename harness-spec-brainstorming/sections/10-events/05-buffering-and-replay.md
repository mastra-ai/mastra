### 10.5 Buffering and replay

Each session keeps a ring buffer of recent events (`sessions.eventBufferSize`, default 1000; see §9). The buffer feeds two consumers:

- **`session.subscribe(...)` after the fact.** If the session is currently in a turn when a new subscriber attaches, the subscriber sees future events only — no automatic backfill. Callers that need to recover from a missed window should use `session.listMessages(...)` for content and the SSE replay path for live event continuation.
- **SSE replay over the wire.** The Mastra Server adapter (§13) honours `Last-Event-ID` on the SSE endpoint. The server replays buffer entries newer than `Last-Event-ID`, then live-tails. See the replay rules below.

**Epoch and event IDs.** Each in-memory Session instance has an `epoch` token, generated fresh whenever the instance is constructed — first hydration, re-hydration after eviction, or hydration after a process restart. Event `id` is `<epoch>-<seq>`, where `seq` is monotonic within the epoch and resets when the epoch changes. Two events from different epochs are never comparable as a sequence, even if they share the same `seq`. Harness-scoped events use the same `<epoch>-<seq>` shape against the harness's own epoch+sequence.

**Replay rules.** On reconnect with `Last-Event-ID: <epoch>-<seq>`:

- If the epoch matches the current Session instance and `seq` is within the buffer, the server replays entries newer than the supplied ID and live-tails.
- If the epoch matches but `seq` is older than the buffer's oldest entry, the buffer has overflowed; the server returns `412 Precondition Failed`.
- If the epoch does not match the current Session instance, the prior epoch's buffer is gone (eviction or process restart). The server returns `412 Precondition Failed`.
- If `Last-Event-ID` is malformed (not `<epoch>-<seq>`) or absent, the server starts the SSE stream from the live tail with no replay.

In every `412` case the client is expected to refetch state via `GET /sessions/:sessionId` and resubscribe.

**Scope.** The buffer is in-memory only. On session eviction or harness shutdown the buffer is dropped along with its epoch — **durable replay across restarts is not a goal of v1**. The epoch contract makes the "stale ID after restart or eviction" path deterministic: any `Last-Event-ID` from a previous epoch is detected at the server and yields `412`, even if a new event happens to share the same `seq`. Synthesizing replay from message storage or any other persisted state is explicitly out of scope; SSE replay is best-effort over the live in-memory ring buffer only. Clients that need durable history beyond a single epoch should use `GET /sessions/:sessionId/messages` (§13.3) for the persisted message log and treat the SSE stream as live-only.
