### 10.6 Subagent attribution

Subagent events are emitted on the **parent** session's subscriber, not the subagent's. This keeps a single live event stream as the source of truth for everything the user sees during a turn. Each `subagent_*` event carries:

- `toolCallId` — the parent's tool-call ID that spawned the subagent. Stable for the subagent's lifetime; pair `subagent_start`/`subagent_end` on this.
- `subagentSessionId` — the **child session's ID**. The subagent runs on its own persisted `SessionRecord` (§5.6); this field exposes that ID on every subagent event so a UI can address the child session directly without a round-trip to look it up. Stable for the subagent's lifetime.
- `parentId` — the parent's tool-call ID *one level up* in the chain. `undefined` for a top-level subagent (parent is the user turn, not another subagent). Used to reconstruct the tree when subagents nest.
- `depth` — `1` for a top-level subagent, `2` for a subagent of a subagent, capped at `subagents.maxDepth` (§8).

**Suspension events from inside a subagent.** Generic events emitted from a subagent's RequestContext (custom events, `tool_approval_required`, `tool_suspension_required`, `question_pending`, `plan_approval_required`) are not translated to `subagent_*` types — that would lose the underlying type information. They surface on the **parent** session's subscriber with:

- `source: 'subagent'`
- `subagentToolCallId: <parent-side tool-call>` — the same handle as `toolCallId` on the corresponding `subagent_start`. Used by the UI to associate the prompt with the right subagent card.
- `subagentSessionId: <child session ID>` — the session that actually owns the pending item. **The client MUST post the response to this session's inbox**, not the parent's. The pending approval / suspension / question / plan record lives on the child session's `SessionRecord`; the parent session has no record of it and does not know how to resume it.

The wire-protocol contract (§13.2) is therefore: for any subagent-attributed pending item, `POST /sessions/<subagentSessionId>/inbox/<toolCallId>`. Posting to `/sessions/<parentSessionId>/inbox/<toolCallId>` returns `404 inbox.item_not_found` — there is no parent-side proxy or dual-write. This keeps the `inbox` resource flat (one-session-one-inbox) and makes durability simple (response writes affect exactly one record).

**Direct subscription to a subagent's stream is supported.** Subagents are normal sessions, so `/sessions/<subagentSessionId>/events` is a valid SSE endpoint. A UI that wants raw subagent-internal events (text deltas, tool calls, custom events that aren't surfaced on the parent) can subscribe directly. Most UIs will not need to — the adapted `subagent_*` events on the parent stream cover the common case — but the option exists for richer renderings.

**Lifecycle coupling.** If the parent session is closed while a subagent has a pending item, `harness.closeSession({ sessionId: parentSessionId })` cascades close to all live descendants (subagents are bound to the parent's lease — §5.8). The pending item disappears with the child session. A client that races to respond after the cascade gets `404 session.closed`. Clients should treat any `subagentSessionId` as valid only between the corresponding `subagent_start` and `subagent_end` on the parent stream.

---
