### 10.6 Subagent attribution

Subagent events are emitted on the **parent** session's subscriber, not the
subagent's. This keeps a single live event stream as the source of truth for
everything the user sees during a turn. Each `subagent_*` event carries:

- `toolCallId` — the parent's tool-call ID that spawned the subagent. Stable for
the subagent's lifetime; pair `subagent_start`/`subagent_end` on this after
`subagent_start` exists.
- `subagentSessionId` — the **child session's ID**. The subagent runs on its own
persisted `SessionRecord` (§5.6); this field exposes that ID on every subagent
event so a UI can address the child session directly without a round-trip to
look it up. Stable for the subagent's lifetime.
- `parentId` — the parent's tool-call ID *one level up* in the chain.
`undefined` for a top-level subagent (parent is the user turn, not another
subagent). Used to reconstruct the tree when subagents nest.
- `depth` — `1` for a top-level subagent, `2` for a subagent of a subagent, and
otherwise the actual persisted `parentSessionId`-chain depth. New descendant
creation is capped by `sessions.maxSubagentDepth` (§8).

When the built-in `subagent` tool call is rejected before creating a child
session — for example because the §8 depth cap is exceeded — no
`subagent_start` is emitted, no `subagentSessionId` is assigned, and no
`subagent_*` bracket exists. Consumers observe that pre-creation failure through
the parent session's normal `tool_end` event for the same `toolCallId` with
`isError: true` and the structured tool-result error; they must not wait for or
synthesize a matching `subagent_end`.

**Suspension events from inside a subagent.** Generic events emitted from a
subagent's RequestContext (custom events, `tool_approval_required`,
`tool_suspension_required`, `question_pending`, `plan_approval_required`) are
not translated to `subagent_*` types — that would lose the underlying type
information. They surface on the **parent** session's subscriber with:

- `source: 'subagent'`
- `subagentToolCallId: <parent-side tool-call>` — the same handle as
`toolCallId` on the corresponding `subagent_start`. Used by the UI to associate
the prompt with the right subagent card.
- `subagentSessionId: <child session ID>` — the session that actually owns the
pending item. **The client MUST post the response to this session's inbox**, not
the parent's (§13.2). The pending approval / suspension / question / plan record
lives on the child session's `SessionRecord`; the parent session has no record
of it and does not know how to resume it.
- `itemId: <pending item ID>` — the inbox route/action key. It may equal the
tool call ID in v1, but clients should route by `itemId` so future pending-item
IDs can diverge.

If a client misses the parent SSE events that carried `subagentSessionId` (for
example after replay-buffer overflow), it can recover the active descendant
pending prompts through
`GET /harness/<harnessName>/sessions/<parentSessionId>/subagent-inbox`
and then post each response to the returned owning subagent session.

**Direct subscription to a subagent's stream is supported.** Subagents are
normal sessions, so `/sessions/<subagentSessionId>/events` is a valid SSE
endpoint. A UI that wants raw subagent-internal events (text deltas, tool calls,
custom events that aren't surfaced on the parent) can subscribe directly. Most
UIs will not need to — the adapted `subagent_*` events on the parent stream
cover the common case — but the option exists for richer renderings.

A local `harness.subscribe(...)` control plane observes both sides when both are
live: parent-adapted `subagent_*` events on the parent session and raw child
session events on the child session. That is expected correlation, not automatic
dedupe. Callers that render a unified tree correlate by `sessionId`,
`subagentSessionId`, `toolCallId`, and event `type`.

**Lifecycle coupling.** Parent close cascades terminally to active descendants
per §5.5/§5.6. Parent eviction and shutdown release the parent/root lease
without closing descendants (§5.6). Route-level close and inbox error behavior
belongs to §13.2.

**Child session validity vs. render correlation.** The `subagent_start` /
`subagent_end` bracket on the parent stream is a render-correlation rule for the
parent-stream activity card keyed by `toolCallId`; it is not the validity window
for `subagentSessionId` as a session identifier. The child session ID remains a
durable address for direct child SSE, snapshots, result lookups, state reads,
and inbox responses while the child session is active (§5.6), including after a
parent replay gap, parent eviction, or process restart. After those gaps,
clients recover active descendant pending prompts through `/subagent-inbox`
(§13.2) and the §13.4 controller recovery flow instead of requiring the lost
parent-stream bracket. Parent close remains the terminal boundary: once an
ancestor enters Closing or Closed, child writes fail through the close-cascade
errors defined by §5.5/§5.6 and routed by §13.2.

---
