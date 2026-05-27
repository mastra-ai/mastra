# Signals audit — PR #16943 (`feat(mastracode): run on Harness v1 runtime`)

Deep audit of signals-related changes in PR
[#16943](https://github.com/mastra-ai/mastra/pull/16943) against the public
signals surface documented at `docs/src/content/en/docs/agents/signals.mdx`
(<https://mastra.ai/docs/agents/signals>) and the `Agent.sendSignal()` /
`Agent.subscribeToThread()` reference at
`docs/src/content/en/reference/agents/agent.mdx`.

Audit branch: `claude/signals-pr-audit-dvAnY`
Branch under audit: `origin/feat/mastracode-harness-v1-runtime` @ `e4c999d03b`
Base: `origin/feat/harness-v1-complete-core` @ `11c4f5ca4f`
Scope diff: 79 files, +7,840 / −330

> Outside of this branch's delta, PR #16943 also carries the parent stack from
> #16912. Where a change landed in the parent (e.g. the live signal route,
> custom event validation, late OM stream events, Last-Event-ID replay for
> closed sessions), this audit treats it as part of the surface that ships
> when this PR merges and judges it against the public docs.

---

## Executive summary

PR #16943 substantially expands the signals/sessions surface but the public
docs (`agents/signals.mdx` + `reference/agents/agent.mdx`) have not moved
with it. The doc page still describes the original four-knob API (`ifActive`
/ `ifIdle` × `behavior` / `attributes`). The PR ships at least seven new
public concepts that are either undocumented, partially documented, or
contradicted by the existing docs.

There are also two real API surface inconsistencies and two carry-overs from
the in-tree audit doc (`mc-harness-v1-mc-audit.md`) that remain partial fixes
at HEAD. None block merge from a checks-green standpoint, but each is a
"signals" promise the docs make that this branch will silently break or
under-deliver on.

**Top findings, ranked by impact:**

1. **Server signal route is published but undocumented** —
   `POST /harness/:name/sessions/:sessionId/signals` (route, schema, and
   `client-js` generated types are all in this PR) has a different shape than
   the documented `Agent.sendSignal()` and uses `content` vs `contents`
   inconsistently between user-message and system-reminder bodies.
   _Required change: doc page + reference page + reconcile field name._
2. **Stable signal IDs (`signalId`) are a new public concept** but appear
   nowhere in `signals.mdx` or `agent.mdx`. The whole "optimistic UI
   reconciliation" story behind PR #16231 only works if hosts know to set it.
   _Required change: doc the field, the round-trip, and where the id comes
   back._
3. **Replay fidelity for user-message signals is only half fixed.** The PR
   restores `attributes` on the `string` fast path
   (`packages/core/src/harness/_shared/message-conversion.ts:126-143`), but
   when `signal.contents` is an `Array<TextPart | FilePart>` (the very shape
   the docs publish), the converter falls through to `msg.content.parts` and
   reconstructs only text/thinking/tool parts — image/file signal content
   stays dropped on replay. This is the unresolved tail of in-tree audit
   Checkpoint 1.
   _Required change: extend converter + add a replay test for file/image
   signal contents._
4. **Queue scheduling (`priority`, `deadline`, `notBefore`) and queue
   backpressure (`reject` vs `drop-oldest`, `queue_full_dropped` event,
   `HarnessQueueFullDroppedError`) ship in this PR** with full server,
   client, storage, and event-stream wiring, but `signals.mdx` mentions
   queues nowhere. Signals docs frame `persist`/`wake` as the only modes;
   they don't say what happens when the host opts a session into
   `drop-oldest` and a queued user-message gets dropped.
   _Required change: at minimum a `Queue interaction` section, plus a
   reference entry for the new event and error._
5. **`sendSignal` reference type is now stale.** The published shape
   (`agent.mdx:172`) lists exactly `attributes`, `metadata`, `providerOptions`
   and a wake/persist/discard `behavior`. The new harness-level surface adds
   `signalId`, `mode`, `additionalTools`, and a server-side schema that
   excludes `attributes`/`metadata`/`providerOptions`/`behavior` entirely on
   `user-message`. Either align the surfaces or document the divergence.
6. **Subscription/replay docs are silent on the new event types and the
   "replay closed sessions via `Last-Event-ID`" behavior**, even though the
   PR's SSE story (parser hardening, `id:` reconnect tokens, terminal-session
   replay) is the main reason `reconnect: true` is now safe.
7. **`mc-harness-v1-mc-audit.md` (1,238 lines) is committed at the repo
   root.** It's a working document, not a deliverable. Either move it under
   `mastracode/` or `.audit/`, or drop it before merge — a markdown file at
   the repo root with no frontmatter shows up oddly in tarballs and search.

---

## Section A — Public signals surface changes shipped in this PR

This section inventories what the PR actually exposes publicly, regardless
of whether the doc gap is in `docs/` or in `reference/`.

### A.1 New / changed types in `@mastra/core`

| File | Change |
| --- | --- |
| `packages/core/src/harness/v1/types.ts:1881` | `SessionSignalOptions.signalId?: string` — caller-supplied stable id |
| `packages/core/src/harness/v1/types.ts:1885-1894` | `SessionSignalOptions.mode?: string` per-signal mode override; `ifActive`/`ifIdle.attributes?: AgentSignalAttributes` documented in type |
| `packages/core/src/harness/v1/types.ts:1899` | `SessionSignalResult.id: string` round-trip — host can match optimistic row to canonical row |
| `packages/core/src/harness/v1/types.ts:1928-1945` | New `SessionInjectSystemReminderOptions { attributes?, metadata? }` and `SessionInjectSystemReminderResult { id, runId, willInterleave, accepted, signal }` |
| `packages/core/src/harness/v1/types.ts:199` | New `HarnessQueueBackpressurePolicy = 'reject' \| 'drop-oldest'` |
| `packages/core/src/harness/v1/types.ts:972-980` | New `HarnessConfigCommon.sessions.queueBackpressure` |
| `packages/core/src/harness/v1/types.ts:1772-1791` | New `QueueOptions.priority`, `QueueOptions.deadline`, `QueueOptions.notBefore` |
| `packages/core/src/storage/domains/harness/types.ts:121-128` | Storage-level `QueuedItem.deadline` and `QueuedItem.notBefore` |
| `packages/core/src/storage/domains/harness/types.ts:158-159` | Storage-level `PendingResume.yolo?: boolean` |

### A.2 New errors / events

| File | Change |
| --- | --- |
| `packages/core/src/harness/v1/errors.ts:591-601` | `HarnessQueueFullDroppedError { code: 'harness.queue_full_dropped', queuedItemId? }` |
| `packages/core/src/harness/v1/errors.ts:615` | Public code map: `HarnessQueueFullDroppedError → 'harness.queue_full_dropped'` |
| `packages/core/src/harness/v1/events.ts:557-568` | New `QueueFullDroppedEvent { source: 'queue'\|'goal', policy: 'reject'\|'drop-oldest', maxQueueDepth, queuedItemId?, admissionId?, replacementQueuedItemId?, replacementAdmissionId?, goalId? }` |
| `packages/core/src/harness/v1/events.ts:883`, `:1197` | Event added to `HarnessEvent` union and to `RESERVED_EVENT_TYPES` |

### A.3 New / changed server surface

| File | Change |
| --- | --- |
| `packages/server/src/server/schemas/harness.ts:436-456` | `harnessQueueAdmissionBodySchema` accepts `priority` / `deadline` / `notBefore` (finite, no `-0`) |
| `packages/server/src/server/schemas/harness.ts:464-487` | `harnessSignalBodySchema` discriminated union — `user-message` uses `content`, `system-reminder` uses `contents` (see Finding F1) |
| `packages/server/src/server/schemas/harness.ts:487-493` | `harnessSignalResponseSchema` returns `{ accepted: true, id, runId, willInterleave, signal }` — no `persisted` promise |
| `packages/server/src/server/handlers/harness.ts:198-204` | Handler interface extended with `priority` / `deadline` / `notBefore` |
| `client-sdks/client-js/src/route-types.generated.ts:20912-20917` | `PostHarnessNameSessionsSessionIdQueue_Body` adds scheduling fields |
| `client-sdks/client-js/src/route-types.generated.ts:21066-21135` | `PostHarnessNameSessionsSessionIdSignals` route fully typed for clients |

### A.4 MastraCode-facing surface

| File | Change |
| --- | --- |
| `mastracode/src/harness/runtime.ts:1131-1163` | `sendSignal(input: SignalInput): SignalHandle` — routes `system-reminder` to `Session.injectSystemReminder()`, user-message to `Session.signal()` with caller-pinned `signalId` |
| `mastracode/src/harness/runtime.ts:1228-1273` | `saveSystemReminderMessage()` now persists directly via `memory.saveMessages` (does NOT call `injectSystemReminder` → does NOT wake) — addresses in-tree audit Checkpoint 2 |
| `mastracode/src/harness/events.ts` (+275, new) | Event projector for v1 → MC display events (subagent, OM, queue) |
| `mastracode/src/harness/config.ts` (+196, new) | MC ↔ v1 config translation incl. subagent definitions, permission policies |
| `mastracode/src/harness/runtime.ts` (+2,200, new) | Full MC runtime layer on top of v1 sessions |

---

## Section B — Documentation gaps

For each gap, this is what `docs/src/content/en/docs/agents/signals.mdx` or
`docs/src/content/en/reference/agents/agent.mdx` should learn from PR #16943
before merge (or in an immediately-following docs PR — current changesets
mention none of this).

### B.1 `signals.mdx` — undocumented public concepts

| Concept | Where it ships | Doc gap |
| --- | --- | --- |
| Stable `signalId` | `SessionSignalOptions.signalId`, `SessionSignalResult.id`, server route body | The page never mentions caller-supplied ids. The "optimistic UI reconciliation" use case from PR #16231 (steer label on while-active signals) implicitly depends on this — undocumented contract. |
| Per-signal `mode` override | `SessionSignalOptions.mode`, server schema | `signals.mdx` only mentions `streamOptions` for the `ifIdle` wake path. There is no parallel for `ifActive`, and `mode` is its own field that overrides the session default for that turn. |
| `additionalTools` override | `SessionSignalOptions.additionalTools: ToolsInput` | Same as `mode`. Undocumented. |
| File/image content | The page only shows `contents: '...'` (string). The agent reference type ( `agent.mdx:172`) shows `Array<TextPart \| FilePart>` but `signals.mdx` itself never demonstrates the array shape | _Required change: at least one example using `{ type: 'file', mediaType, data }` in `contents`._ |
| Queue interaction | `QueueOptions.{priority,deadline,notBefore}` + `queueBackpressure` config | `signals.mdx` frames `ifIdle.behavior: 'persist'` as the "save without wake" path — but the durable transport for queued user-messages is the harness queue, and the queue now has scheduling and a `drop-oldest` policy. A user reading `signals.mdx` cannot tell whether `persist` puts a signal at the back of a `drop-oldest` queue. |
| `queue_full_dropped` event + `HarnessQueueFullDroppedError` | events.ts, errors.ts | Page should mention what happens when a `persist` signal is rejected/dropped, and how `subscribeToThread()` observes it. |
| Reserved event types | `RESERVED_EVENT_TYPES` set in events.ts | `EventEmitter.emit(...)` now validates custom event names (commit `bed27f6314`, "validate custom event emission"). Hosts that want to emit custom events from the same pipeline need to know what's reserved. Page should link out from the existing _"Use XML-safe signal type names"_ note. |
| Last-Event-ID replay for closed sessions | session.ts + server handler (parent stack, commit `57910575b7`) | The page's `Keep custom SSE subscriptions alive` section explains heartbeats and `reconnect: true`. It does not explain that the server now serves durable replay from closed/closing sessions when `Last-Event-ID` is set. This is the key reason `reconnect: true` is now correct. |
| `shell_output` event from sandbox stdout/stderr | session.ts:3715-3739 + tests | Subscribers now receive `shell_output { stream: 'stdout' \| 'stderr' }` events normalized from `data-sandbox-stdout` / `data-sandbox-stderr` writer chunks. Existing docs don't enumerate event types at all — a `Subscription event types` section is overdue. |
| Late OM events preserved past `agent_end` | commit `321d263744`, tests in `session.events.test.ts:894-997` | If a host listens for OM lifecycle markers off a thread subscription, the new contract is "`om_observation_end` may arrive after `finish` but before `agent_end`". Currently undocumented. |

### B.2 `signals.mdx` — internal inconsistencies

| Line | Issue |
| --- | --- |
| `signals.mdx:25-45` | Quickstart calls `agent.subscribeToThread()` then `agent.sendSignal(...)`. The PR adds a server-side analog (`POST /harness/.../signals`). Either link to it or scope this page as "Agent SDK" and create a sibling reference. |
| `signals.mdx:71-78` | The `behavior` matrix lists exactly `deliver` / `persist` / `discard` for `ifActive` and `wake` / `persist` / `discard` for `ifIdle`. The server harness route does NOT model `behavior` at all — only `attributes`. Either expose it server-side or call out the asymmetry. |
| `signals.mdx:154` | _"Use XML-safe signal type names..."_ ends without saying what happens when a custom event collides with a reserved name. Per `events.ts:1181-1205`, the new validation rejects reserved-prefix events at `EventEmitter.emit()`. |

### B.3 `reference/agents/agent.mdx` — stale type

The `sendSignal` reference (`agent.mdx:164-216`) lists exactly this:

```ts
signal: { type, contents, attributes?, metadata?, providerOptions? }
options: { resourceId, threadId, ifActive?, ifIdle? }
returns: { accepted: true, runId: string, signal: CreatedAgentSignal, persisted?: Promise<void> }
```

After PR #16943 the server-side contract (`harnessSignalBodySchema` and
`SessionSignalOptions`) actually allows / returns:

```ts
signal: { type: 'user-message', content, signalId?, mode?, ifActive?, ifIdle? }
     | { type: 'system-reminder', contents, attributes?, metadata? }
returns: { accepted: true, id, runId, willInterleave, signal }
```

Concrete deltas the reference must address:

- `signalId` is missing from the input row.
- `mode` (server-side `user-message`) is missing.
- `content` vs `contents` mismatch (see Finding F1).
- The reference says `persisted?: Promise<void>` is returned for `persist`
  behavior — the new server response doesn't expose `persisted` at all.
- `willInterleave: boolean` is a new public field — what does
  `willInterleave: false` mean for a `user-message`? The reference should
  say.
- The published response type `CreatedAgentSignal` does not match
  `harnessSignalResponseSchema`'s `signal: z.unknown()`. Either tighten the
  schema or weaken the reference type — having both is misleading.

### B.4 New reference pages required

Two pages do not exist and arguably should:

1. **`reference/harness/signals.mdx`** — documents
   `POST /harness/:name/sessions/:sessionId/signals` and
   `POST /harness/:name/sessions/:sessionId/queue`, including the new
   scheduling options, the `queue_full_dropped` event, and the divergent
   user-message body shape. Right now this contract is only visible by
   reading the Zod schema in `packages/server/src/server/schemas/harness.ts`.
2. **`reference/harness/events.mdx`** (or expand the existing harness ref) —
   enumerates every event in `HarnessEvent` (events.ts:870-905) and notes
   which are reserved. The PR adds five new events (`queue_full_dropped`,
   `queue_item_replayed`, `queue_item_cancelled`, `queue_item_expired`,
   `om_*` typed lifecycle, `subagent_*`) — none are described publicly.

---

## Section C — API surface inconsistencies

These are real divergences between two published surfaces that ship in this
PR. Either pick one shape or document why both exist.

### C.1 `content` (singular) vs `contents` (plural) field name

Three published shapes disagree on the name of the field carrying the signal
body.

| Surface | `user-message` field | `system-reminder` field |
| --- | --- | --- |
| `agents/signals.mdx`, `reference/agents/agent.mdx` | `contents` | `contents` |
| `packages/server/src/server/schemas/harness.ts:466-483` | **`content`** | `contents` |
| `client-sdks/client-js/src/route-types.generated.ts:21085-21126` | **`content`** | `contents` |
| `mastracode/src/harness/runtime.ts:1141, 1151` (input)             | `contents` (input) → `content` (forwarded to Session) | `contents` |

A user sending a signal over the remote harness route will get a 400 with
`unrecognized_keys: ['contents']` if they copy the example from
`agents/signals.mdx`. The MC runtime translates the discrepancy internally,
but the discrepancy is real on the wire.

_Recommendation:_ pick one (`contents`) and adjust the server schema /
generated types. The cost is one breaking change in pre-1.0 / experimental
territory (the page is currently labelled `:::experimental`), but leaving it
will become a long-term doc tax.

### C.2 Server route drops `behavior`, top-level `attributes` and `providerOptions` on `user-message`

The `Agent.sendSignal()` page promotes:

- `ifActive.behavior: 'deliver' | 'persist' | 'discard'`
- `ifIdle.behavior: 'wake' | 'persist' | 'discard'`
- top-level `attributes` and `metadata`
- `providerOptions`

The harness route schema (`harnessSignalBodySchema`, lines 466-483) only
accepts `ifActive.attributes` and `ifIdle.attributes` for `user-message`. No
`behavior`, no top-level `attributes`/`metadata`, no `providerOptions`. The
`system-reminder` branch accepts top-level `attributes` and `metadata` but
no `ifActive`/`ifIdle` at all.

_Recommendation:_ broaden the schema to mirror `AgentSendSignalOptions` (or
explicitly carve out the harness route as the "session-coupled" variant in
the docs and add a focused warning that hosts wanting `persist` must use the
Agent path).

### C.3 `signal.contents` array shape is over-permissive in the server schema

```ts
content: z.union([z.string().min(1), z.array(jsonRecordSchema).min(1)])
```

`jsonRecordSchema` is `z.record(z.string(), jsonValue)`. The docs publish
`Array<TextPart | FilePart>` (`agent.mdx:172`). The server schema accepts
any record array — `{ foo: 1 }` is admitted. Either:

- tighten to a discriminated union of `TextPart`/`FilePart`/`ImagePart`, or
- explicitly document that the route is permissive and validation is at the
  session layer.

### C.4 `attributes` value type narrowed across the converter

`packages/core/src/harness/_shared/message-conversion.ts:127-130` types
preserved attributes as
`Record<string, string | number | boolean | null | undefined>`, but
`AgentSignalAttributes` (used by the agent SDK) is wider —
`Record<string, JSONValue>`. A signal sent with
`attributes: { tags: ['a', 'b'] }` will round-trip through send/persist/list
with `tags` silently dropped. _Recommendation:_ widen converter typing to
`JSONValue` to match the agent SDK type, or trim earlier on the send path.

---

## Section D — Replay / persistence behavioral gaps

### D.1 Replay drops non-text signal content (Checkpoint 1, partial)

`packages/core/src/harness/_shared/message-conversion.ts:131-143` (post-PR):

```ts
if (signal?.type === 'user-message' && typeof signal.contents === 'string') {
  content.push({ type: 'text', text: signal.contents });
  return { ..., ...(userSignalAttributes ? { attributes: userSignalAttributes } : {}), createdAt };
}

// Array<TextPart | FilePart> falls through to msg.content.parts loop below.
// That loop only emits text/thinking/tool parts — it does NOT reconstruct
// file/image content from signal.contents.
```

The legacy converter in
`packages/core/src/harness/harness.ts:107-131` had
`signalContentsToHarnessContent()` that reconstructed file/image parts; the
v1 _shared converter never grew an equivalent. This means:

- A user sends `agent.sendSignal({ type: 'user-message', contents: [{ type: 'text', text: 'see this' }, { type: 'file', mediaType: 'image/png', data }] })`
- It is stored.
- On thread reload, `listMessages()` returns the user-message row with
  whatever happens to be in `msg.content.parts` — which may or may not
  include the image, depending on how the storage layer projected it.
- TUI re-render and `renderExistingMessages()` cannot reliably reproduce the
  signal as sent.

_Required change:_
1. Extend `convertStoredMessageToHarnessMessage()` to walk
   `signal.contents` when it is an array and convert each part directly to
   `HarnessMessageContent` (text/file/image), mirroring legacy.
2. Add tests in `packages/core/src/harness/v1/list-messages.test.ts`:
   - persisted user-message signal with `contents` of mixed text + file
     survives `listMessages()` with both parts present
   - persisted user-message signal with `attributes` survives _and_
     `delivery: 'while-active'` reaches the renderer's input

The in-tree audit (`mc-harness-v1-mc-audit.md:81-126`) explicitly called
this out; only the string fast path was addressed by this PR.

### D.2 System-reminder persist-only semantics — verify the runtime path

The in-tree audit flagged that `MastraCodeHarnessRuntime.saveSystemReminderMessage()`
used to call `Session.injectSystemReminder()`, which wakes idle agents
(`session.ts:5325-5409`). At HEAD,
`mastracode/src/harness/runtime.ts:1228-1273` now persists directly through
`memory.saveMessages()` and does _not_ go through the session. That fixes
the wake risk but introduces a different concern:

- The persist-only path bypasses session locks and event emission. A
  consumer subscribing via `Session.subscribe()` will not see a
  `message_*` event for the persisted reminder.
- A subsequent `session.message()` admitted concurrently with
  `saveSystemReminderMessage()` could race the memory write.

_Recommendation:_ either
1. add a `Session.injectSystemReminder({ behavior: 'persist' })` mode in core
   so the persist path stays under the session mutation queue and still
   emits a typed event, then route MC's `saveSystemReminderMessage()` to it;
   or
2. add a runtime test that asserts (a) the row appears in `listMessages()`
   and (b) no `agent_start`/`agent_end` is emitted, _and_ asserts ordering
   under concurrent `session.message()`.

### D.3 Live `sendSignal(system-reminder)` still wakes

For the live path (`mastracode/src/harness/runtime.ts:1131-1148`) the
`type: 'system-reminder'` branch still routes through
`Session.injectSystemReminder()` which is documented in `signals.mdx` as the
wake/interleave variant. That's correct for the live signal use case
(external event sources), but the doc page conflates it with the persist
path: example at `signals.mdx:131-152` shows `type: 'system-reminder'`
without `ifIdle: { behavior: 'persist' }` and does not say what the default
is. Tightening the example to show both modes (deliver into a running run,
vs wake idle, vs persist-only via the Agent SDK) would resolve the
ambiguity.

---

## Section E — Test coverage gaps

| Gap | Where to add |
| --- | --- |
| File/image signal content survives replay | `packages/core/src/harness/v1/list-messages.test.ts` |
| `attributes` with non-primitive values (arrays/objects) round-trip — if intentionally narrowed, assert the narrowing | `packages/core/src/harness/v1/list-messages.test.ts` |
| `saveSystemReminderMessage()` persists without `agent_start` event, races cleanly with concurrent `session.message()` | `mastracode/src/harness/runtime.test.ts` |
| Server signal route — explicit `signalId`, `mode`, `ifActive.attributes`, `ifIdle.attributes` reach `Session.signal()` correctly | `packages/server/src/server/handlers/harness.test.ts` (currently only +6 lines) |
| Server signal route — `system-reminder` body validation rejects/accepts the right shapes | `packages/server/src/server/handlers/harness.test.ts` |
| Custom event validation — reserved-name rejection, `om_*`/`subagent_*` passthrough | already present in `session.events.test.ts:894-997` ✅ |
| Last-Event-ID replay against closed sessions, including signal events | `packages/server/src/server/handlers/harness.test.ts` (parent stack already covers replay; verify signal-event ordering specifically) |
| `queue_full_dropped` fires on a `user-message` signal that lands in a full `drop-oldest` queue (signal-side test, not just queue-side) | `packages/core/src/harness/v1/session.queue.test.ts` covers queue; no test confirms the same flow when the durable transport is a `persist` signal |

---

## Section F — Cleanup / hygiene

1. **`mc-harness-v1-mc-audit.md` is committed at the repo root** (1,238
   lines, no frontmatter). It's an excellent working document but does not
   belong at the root of a published monorepo. Move under
   `mastracode/audits/` or remove before merge. Confirmed not referenced
   from any other shipped file.
2. **Changesets are silent on signals.** Of the seven changesets in this
   PR:
   - `blue-results-pull.md` covers queue scheduling
   - `tired-regions-act.md` covers queue backpressure
   - `full-monkeys-teach.md` is the only one touching replay (
     _"Fixed Harness v1 message replay and workspace stream event handling."_
     — generic; no mention that signal `attributes` are now preserved)
   - `harness-v1-mastracode-runtime.md` says _"threads, signals,
     permissions, tasks, and display events now flow through Harness v1"_ —
     no callout that the live signal route, `signalId`, and per-signal mode
     are new public surfaces, no mention of the `content`/`contents`
     mismatch.

   _Recommendation:_ add or expand a changeset for `@mastra/core` that names
   the new `signalId`, `mode`, and `injectSystemReminder` surfaces, and one
   for `@mastra/server` / `@mastra/client-js` that names the new harness
   signals route. Per `.mastracode/commands/changeset.md`, breaking-or-new
   signal-shape changes should include a code example.
3. **PR commit set includes several merges from `feat/harness-v1-complete-core`
   into `pr-16943`.** Cosmetic, but it complicates `git log --oneline` for
   reviewers reading the signals story. Squash-merge to base, or rebase
   before final review.

---

## Section G — Action items, in priority order

| # | Item | Owner area | Blocking? |
| ---: | --- | --- | --- |
| 1 | Fix replay for `Array<TextPart \| FilePart>` user-message signals (D.1) and add tests (E) | `@mastra/core` | **Yes** — silent data loss for in-flight users of #16231 |
| 2 | Reconcile `content` vs `contents` (C.1) — pick one across server schema, generated types, and docs | `@mastra/server`, `client-js`, `docs` | **Yes** — the published example in `signals.mdx` does not work against the published route |
| 3 | Document `signalId` in `signals.mdx` + `agent.mdx` (B.1, B.3) | `docs` | High — required to actually use the new surface |
| 4 | Document the live harness signal route (B.4) or remove it from this PR's scope | `docs`, possibly `@mastra/server` if scoped out | High |
| 5 | Update `agent.mdx:164-216` `sendSignal` reference type to include `signalId`, `mode`, `willInterleave` and to match the new return shape (B.3) | `docs` | High |
| 6 | Document queue scheduling + backpressure interaction with `persist` signals (B.1, B.2) | `docs` | Medium |
| 7 | Document `Last-Event-ID` replay for closed sessions and the new event types (B.1) | `docs` | Medium |
| 8 | Decide on system-reminder persist-only architecture (D.2) | `@mastra/core`, `mastracode` | Medium |
| 9 | Widen converter `attributes` typing to `JSONValue` (C.4) or trim earlier | `@mastra/core` | Low — but a future foot-gun |
| 10 | Tighten server signal `content` array schema or document permissiveness (C.3) | `@mastra/server` | Low |
| 11 | Move or delete `mc-harness-v1-mc-audit.md` (F.1) | repo hygiene | Low |
| 12 | Expand changesets to call out new signals surface (F.2) | repo hygiene | Low — but our changeset guide says we should |

---

## Appendix — Commits in this branch that touched signals/SSE/queue

```
66979f21c5 feat(harness): expose live signal route
bed27f6314 fix(harness): validate custom event emission
321d263744 fix(harness): preserve late om stream events
57910575b7 fix(harness): replay events for closed sessions
7bd1599428 fix(harness): bridge om activation events
8d3c34fdf0 feat(harness): filter workspace action journal entries
704a385021 feat(core): add harness queue backpressure
318abc7830 feat(core): add harness queue scheduling options
6344e771f6 fix(harness): resolve v1 tool permissions per call
e9b0448692 feat(mastracode): run on harness v1 runtime  (initial)
04822e3647 fix(mastracode): complete native harness runtime adoption
fd5a1d9fd8 fix(mastracode): tighten native harness v1 adapter
38ec49df9e fix(harness): tighten replay and workspace action taxonomy
```

Source for branch diff: `git log --oneline origin/feat/harness-v1-complete-core..origin/feat/mastracode-harness-v1-runtime`.
