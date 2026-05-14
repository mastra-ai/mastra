## 10. Events

Orientation diagram (cross-child reader map only; §10.1–§10.6 remain
authoritative for event shape, the closed union, custom events, ordering,
buffering/replay rules, and subagent attribution):

<figure>
  <svg role="img" aria-labelledby="hx-events-overview-title hx-events-overview-desc" viewBox="0 0 1040 540" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-events-overview-title">Event lifecycle and replay map</title>
    <desc id="hx-events-overview-desc">Sources project into the closed HarnessEvent union through a Harness-owned event adapter. Session-scoped events are stamped with an epoch-seq id, buffered in-memory for SSE replay, and fanned out to session and harness subscribers. Harness-scoped events are live-only.</desc>
    <defs>
      <marker id="ah-events-overview" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="40" y="28">Sources (implementation inputs only; never public IDs or replay cursors)</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="40" y="40" width="220" height="68" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="150" y="68" text-anchor="middle">Agent + workflow + pubsub</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="150" y="90" text-anchor="middle">turn activity, tool, suspension</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="280" y="40" width="220" height="68" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="390" y="68" text-anchor="middle">Channel adapter</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="390" y="90" text-anchor="middle">channel_* transitions (§14)</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="520" y="40" width="220" height="68" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="630" y="68" text-anchor="middle">Harness scheduler</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="630" y="90" text-anchor="middle">intervals · wakeups · workers</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="760" y="40" width="240" height="68" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="880" y="68" text-anchor="middle">Lifecycle observer</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="880" y="90" text-anchor="middle">session_evicted · shutdown · storage error</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="40" y="138" width="960" height="76" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="60" y="164">Harness-owned event adapter</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="60" y="188">projects into the closed HarnessEvent union (§10.2); custom events covered in §10.3</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="60" y="208">stamps id = epoch-seq on session-scoped events (§10.1) and harness-scoped events against the harness epoch</text>

    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-events-overview);" d="M150 108 L290 137" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-events-overview);" d="M390 108 L450 137" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-events-overview);" d="M630 108 L600 137" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-events-overview);" d="M880 108 L760 137" />

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="40" y="240" width="460" height="200" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="60" y="266">Session-scoped lane</text>

    <rect style="fill: #ffffff; stroke: #06b6d4; stroke-width: 1.6; rx: 12;" x="60" y="280" width="200" height="60" />
    <text style="font: 600 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="160" y="304" text-anchor="middle">in-memory ring buffer</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="160" y="324" text-anchor="middle">eventBufferSize (§9)</text>

    <rect style="fill: #ffffff; stroke: #06b6d4; stroke-width: 1.6; rx: 12;" x="280" y="280" width="200" height="60" />
    <text style="font: 600 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="380" y="304" text-anchor="middle">session.subscribe live</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="380" y="324" text-anchor="middle">+ harness fan-out copy</text>

    <rect style="fill: #ffffff; stroke: #06b6d4; stroke-width: 1.6; rx: 12;" x="60" y="356" width="420" height="60" />
    <text style="font: 600 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="270" y="380" text-anchor="middle">SSE replay (§10.5)</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="270" y="400" text-anchor="middle">Last-Event-ID → live tail · 412 on overflow / epoch change</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="520" y="240" width="480" height="200" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="540" y="266">Harness-scoped lane</text>

    <rect style="fill: #ffffff; stroke: #f97316; stroke-width: 1.6; rx: 12;" x="540" y="280" width="440" height="60" />
    <text style="font: 600 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="760" y="304" text-anchor="middle">harness.subscribe live</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="760" y="324" text-anchor="middle">no merged replay buffer · no Last-Event-ID · live-only</text>

    <rect style="fill: #ffffff; stroke: #f97316; stroke-width: 1.6; rx: 12;" x="540" y="356" width="440" height="60" />
    <text style="font: 600 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="760" y="380" text-anchor="middle">subagent attribution (§10.6)</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="760" y="400" text-anchor="middle">child sessions stamp own epoch; parent observes through harness fan-out</text>

    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-events-overview);" d="M400 214 L160 279" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-events-overview);" d="M520 214 L380 279" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-events-overview);" d="M620 214 L760 279" />

    <rect style="fill: #f1f5f9; stroke: #cbd5e1; stroke-width: 1.5; stroke-dasharray: 5 5; rx: 12;" x="40" y="464" width="960" height="58" />
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="60" y="486">Events are observer notifications, not durable integration history.</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="60" y="506">Missing or replayed events never alter admission, idempotency, retries, receipts, or delivery guarantees — recovery reads storage rows.</text>
  </svg>
  <figcaption>One Harness event adapter projects supported source activity into the closed HarnessEvent union; session-scoped events are buffered for SSE replay while harness-scoped events stay live-only.</figcaption>
</figure>

Events are how the harness reports what's happening to subscribers. They fan out
two ways:

- **Session-scoped** — emitted on a specific session and delivered to every
subscriber of that session (`session.subscribe(...)`). All turn-level activity
flows here. A live fan-out copy is also delivered to the owning harness's
`harness.subscribe(...)` subscribers, with `sessionId` set.
- **Harness-scoped** — emitted at the harness level for things that don't belong
to any one session (intervals, process shutdown, storage errors, malformed or
unbound channel ingress). Delivered to harness subscribers
(`harness.subscribe(...)`). Session-lifecycle events are harness-delivered
observer notifications that carry `sessionId` for the affected session; storage
state and result records are the source of truth.

Both surfaces use the same listener shape: `(event: HarnessEvent) => void`,
returning an unsubscribe function.

`harness.subscribe(...)` is the local/in-process control-plane stream for one
Harness instance. It receives harness-scoped events plus the future session
events emitted by every live `Session` owned by that instance, including
child/subagent sessions. It is live-only: no automatic backfill, no durable
aggregate buffer, no `Last-Event-ID` replay cursor, and no global cross-session
ordering guarantee. Filtering by `sessionId`, event type, `resourceId`, channel
metadata, or other payload fields stays caller-side in v1.

Events are observer notifications, not a command bus or durable integration
ledger. Built-in `channel_*` events reflect transitions in the source-specific
ledger rows (§5.1, §14); recovery workers and dispatchers read storage rows, not
event history. Missing, replayed, or stale events must not affect admission,
idempotency, retries, receipts, or delivery guarantees.

All inner agent, workflow, pubsub, legacy Harness, and server observe streams
enter the public Harness event surface only through a Harness-owned event
adapter. That adapter projects supported source activity into the closed
`HarnessEvent` union, stamps §10.1 identity in the target session or harness
epoch, excludes non-public legacy display notifications such as
`display_state_changed`, and feeds the §10.5 in-memory session replay buffer
when the event is session-scoped. Current source stream IDs, topic offsets,
cache history, or observe-route bodies are implementation inputs only, not v1
event IDs, replay cursors, or public SSE contracts; §11 records the current-code
migration boundary.

**Source streams and selected projection.** The adapter consumes four named
Mastra surfaces and projects only the subset that has a v1 public-event home:

1. **Agent stream chunks.** `AgentChunkType` at
   `../packages/core/src/stream/types.ts:708` is the runtime stream of
   `text-*` / `reasoning-*` / `tool-call*` / `tool-result` / `tool-error` /
   `finish` / `error` / `step-*` / `background-task-*` / `object*` / `watch` /
   `tripwire` chunks. Selected chunks project to v1 events:
   `text-delta` → `TurnEvent.text_delta`;
   final `tool-call` → `ToolEvent.tool_start` (after the input is finalized;
   `tool-call-input-streaming-start` / `tool-call-delta` /
   `tool-call-input-streaming-end` precursors do not produce per-chunk
   events — they are compatibility inputs only, and adding per-chunk public
   variants would reopen the §15.3 "Broader `AgentStream` chunk/replay
   schemas" deferral);
   `tool-result` and `tool-error` → `ToolEvent.tool_end` (the latter with
   `isError: true`);
   `tool-call-approval` → `SuspensionEvent.tool_approval_required` **after**
   the corresponding `PendingApproval` row commits under the session lease;
   `tool-call-suspended` → `SuspensionEvent.tool_suspension_required`
   **after** the corresponding `PendingToolSuspension` row commits under the
   session lease (per §15.1 "Per-run pending interaction slot"; the chunk
   arrives, the durable row commits, then the event emits — adapters must
   not emit from the chunk and write the row asynchronously);
   `finish` → `TurnEvent.agent_end`;
   `error` → `TurnEvent.error`.
   All other chunk families (`reasoning-*`, `source`, `file`,
   `response-metadata`, `redacted-reasoning`, `text-start` / `text-end`,
   `start`, `step-start` / `step-finish` / `step-output`, `tool-output`,
   `tripwire`, `watch`, `is-task-complete`, `object` / `object-result`,
   `raw`, `abort`) are compatibility inputs for display state, message
   history, diagnostics, or internal flow only; they are not v1 event IDs,
   replay cursors, or public wire fields. `background-task-*` chunks
   project through the §4.8c / §5.1b.2 background-task surfaces (HC-202),
   not directly to `HarnessEvent`.
2. **Workflow events.** Workflow runs (`../packages/core/src/workflows/`)
   emit step lifecycle events that the goal-judge implementation and other
   internal flows consume (§4.7). Workflow step events are not part of the
   public `HarnessEvent` union and do not cross the SSE boundary.
3. **Pubsub substrate.** Mastra's pubsub primitives
   (`../packages/core/src/events/types.ts`,
   `../packages/core/src/events/pubsub.ts`,
   `../packages/core/src/events/caching-pubsub.ts`,
   `../packages/core/src/events/event-emitter.ts`) are the underlying
   transport for source streams; durable-agent stream wrappers at
   `../packages/core/src/agent/durable/constants.ts:21` and
   `../packages/core/src/agent/durable/stream-adapter.ts:124` package
   `AgentChunkType` into pubsub events. `SubscribeOptions.group`
   (consumer-group routing), `ack`/`nack` redelivery, `Event.index`,
   `subscribeFromOffset`, `getHistory`, and `CachingPubSub` cache history
   are implementation inputs; §10.4 in-epoch ordering, §10.5 in-memory
   replay buffer, and §13.3d SSE envelope are the v1 surfaces and do not
   expose pubsub-level identifiers.
4. **Legacy `HarnessEvent`.** Current Mastra's `HarnessEvent` union at
   `../packages/core/src/harness/types.ts:704` is `changed-v1` per §11.6a.
   The legacy-to-v1 projector is the migration boundary that translates
   legacy bare codes into v1 namespaced envelopes (§13.3f.1) and excludes
   legacy display notifications like `display_state_changed`.

The four sources are compatibility inputs; the v1 contract is the closed
`HarnessEvent` union below and the §13.3d SSE envelope. Stream-chunk
identifiers, workflow-step IDs, pubsub topic offsets, and legacy event
shapes are not v1 IDs, replay cursors, or wire fields.
