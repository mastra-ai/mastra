### 5.7c Crash Mid-Turn

**Crash mid-turn.** What a freshly hydrated session looks like depends on where
the crash hit and which primitive originated the input:

**`message(...)` in flight, signal not yet accepted by the agent**

After hydration: **Lost.** The message was never persisted (Slack semantics —
`message` items aren't on `pendingQueue`). The caller's pending promise rejects.
The user resends if they want the message delivered.

**`message(...)` accepted, run started, no suspension**

After hydration: Agent-layer durability: the signal is recorded in the agent's
thread log with `signalId`, `runId`, and terminal result status or an
interrupt/error status when known. The session may have `currentRun` for
inspection. On hydration, the harness re-attaches through the agent signal
boundary's result lookup/subscription surface (§4.2) and reconciles `currentRun`
against the agent/thread store. If the run completed before crash, the assistant
turn is in the thread log, the message-result route can answer by `signalId`,
and `currentRun` becomes terminal or is cleared. If it didn't, the model output
is lost — but the user-side input survives in the thread log so they can ask
again; unresolved result lookup eventually reports `failed` rather than
`pending` forever (the `currentRun.status` may be `interrupted`, but the
operation result wire state is `failed`), and `getCurrentRunId()` returns `null`
unless the agent layer reports a still-live run or a persisted pending item
keeps the run waiting.

**`queue(...)` enqueued but not yet drained**

After hydration: Durable. Item still on `pendingQueue`, and its
`QueueAdmissionReceipt` remains `queued`. On the next `harness.session(...)` and
once the thread is idle, the head is drained (signalled) as a fresh standalone
turn.

**`queue(...)` drain started, signal acceptance unknown**

After hydration: At-least-once admission, not blind turn replay. The item
remains in `pendingQueue` and its `QueueAdmissionReceipt` is `queued`,
`admitting`, or retryable `admission_failed`. On hydration the owner retries
signal admission with the same `admissionId` / `admissionHash`; an already
accepted admission returns the original `runId` / `signalId`, while a truly
unaccepted admission is accepted for the first time or records another retryable
admission failure.

**`queue(...)` signal accepted, run mid-flight**

After hydration: Post-acceptance reconciliation. The receipt records
`status: 'accepted'`, `runId`, and `signalId`; the item is removed from
`pendingQueue` only after the turn completes. On hydration the owner
observes/reconciles the accepted run by `signalId` / `runId` and must not send a
second signal for the same queued item. If the agent/thread store already has
terminal output before the session flush completed, recovery marks the receipt
`completed` or post-acceptance `failed`, stores result/error metadata, removes
the queue head, and resumes draining. Non-idempotent tools still need their own
effect receipts, but queue recovery does not intentionally duplicate accepted
signals.

**Goal judge in flight, no receipt persisted**

After hydration: The judge call is not resumed. On hydration, after run
reconciliation, the owner computes the latest assistant-turn cursor. If the goal
is still active and `GoalState.lastDecision` does not cover that cursor, the
owner may call the judge again, subject to the same commit-time source-turn
freshness guard as the live lifecycle (§4.7). If the goal was paused, cleared,
or replaced before the crash, no judge runs.

**Goal judge `continue` receipt persisted, continuation not yet queued**

After hydration: `GoalState.lastDecision` proves the source turn was already
judged and carries `continuation.admissionId`. Recovery does not re-judge; it
appends the continuation via ordinary FIFO `queue(...)` with the same
`admissionId` and stable hash at the repair commit point, then the
`QueueAdmissionReceipt` owns ordering and admission retry. If the continuation
receipt already exists, recovery observes it instead of appending another item.

**Goal continuation queued or accepted, run mid-flight**

After hydration: `GoalState.lastDecision.continuation.admissionId` points to the
queue receipt. Recovery does not re-judge the source turn; queue recovery
handles `queued`, `admitting`, `accepted`, terminal, and retention/tombstone
states exactly as for user-queued work.

**Channel inbound webhook saved but not yet admitted**

After hydration: Durable. The `ChannelInboxItem` remains `received`; a recovery
worker claims stale received rows and re-runs binding resolution and admission.
Provider webhook retries hit the same `idempotencyKey` and observe the existing
item instead of creating a second user message. Transient failures move through
`failed` with `nextAttemptAt`; exhausted rows become `dead` for operator repair.

**Channel inbound admitted via `message(...)`, signal not yet accepted**

After hydration: At-least-once admission. The `ChannelInboxItem` remains
`admitted`; on recovery the bridge claims the row and retries admission using
the persisted content, attachments, request context, delivery choice,
policy-selected mode/model overrides, and `ChannelInboxItem.admissionId` as the
signal/queue idempotency key. If the original signal was accepted before the
crash but the inbox status did not update, that key prevents a duplicate
accepted signal. Transient failures follow the same `failed` / `dead` retry
policy.

**Durable session/thread state exists but matching channel outbox row was not enqueued**

After hydration: Recoverable projection. Channel outbox items use deterministic
idempotency keys derived from durable source IDs. A recovery projector scans
pending inbox prompts, applied inbox responses, and persisted assistant outputs
and enqueues missing rows idempotently.

**Channel outbound enqueued but not delivered**

After hydration: Durable. The `ChannelOutboxItem` remains `pending` or its claim
expires; a dispatcher claims and retries it with the same provider idempotency
key.

**Channel outbound delivered but not marked sent**

After hydration: Provider-dependent. The dispatcher may retry. Adapters with
native idempotency, deterministic client message IDs, or lookup/reconcile
capability suppress duplicate external posts; adapters without those
capabilities are at-least-once and may duplicate a user-visible post.

**Channel action callback saved but not applied**

After hydration: Durable. The `ChannelActionToken` remains the pre-first-use
token/projection record, and the `ChannelActionReceipt` remains `received`,
`accepted`, or retryable `failed`; provider retries and double-clicks load the
same token/receipt by `actionTokenId`, and recovery workers can claim stale
receipts. Current action-token expiry or revocation does not block replay of a
receipt that was already durably created from the same authenticated token
identity. The bridge retries the owning session inbox response with
`itemId = receipt.itemId` and `responseId = receipt.id`; if the owning session's
`InboxResponseReceipt` is already `applied`, it returns the original result
instead of resuming twice. If it is only `accepted`, recovery retries resume
with the same `responseId` / `resumeAttemptId`. Exhausted receipts become `dead`
for operator repair.

**Inbox response accepted but run resume not yet applied**

After hydration: Durable only when the §4.2 Required Agent Resume Boundary
supports the pending-item kind with `resumeAttemptId = responseId` idempotency.
The `InboxResponseReceipt(status: 'accepted')` remains on the owning session,
keeps `currentRun.status = 'resuming'`, and recovery retries the resume with the
same `responseId` / `resumeAttemptId`. Hot-path tool-suspension callers observe
`HarnessRecoveryDeferredError` (§4.5) when this accepted state exists but the
workflow snapshot is not yet observable. Without idempotent resume support this
boundary can degrade to at-most-once/lost resume if the workflow snapshot was
consumed before durable completion, so Harness v1 disables retrying external
response paths for that pending-item kind before consuming the pending item
rather than claiming exactly-once action application.

**Goal judge question auto-answer accepted but run resume not yet applied**

After hydration: Same inbox-response recovery boundary. The deterministic judge
`responseId` and `InboxResponseReceipt.goalJudge` metadata prove which goal
attempt won the pending question. Recovery retries the resume with the same
`responseId` / `resumeAttemptId`; it does not re-ask the judge for that consumed
pending item, and later goal pause/clear/replace does not undo the already
accepted inbox response.

**Channel action applied but platform card not updated**

After hydration: Durable resume. The `ChannelActionReceipt` is `applied`; the
outbox may enqueue an `inbox-resolution` edit/status item. If that edit was not
delivered, outbox retry handles platform reconciliation.

**Suspended on tool approval**

After hydration: `pendingApproval` is rehydrated. The workflow snapshot in
`MastraStorage.workflows` survives the crash (it's owned by the agent layer, not
the harness). The user responds via `respondToToolApproval(...)`; harness
resumes through the §4.2 Required Agent Resume Boundary with
`{ approved, reason? }` as the opaque resume payload. Before the resumed tool
action executes, the §4.2 pre-action permission gate re-evaluates against the
owning session's current permission rows; a permission change to effective
`deny` after the prompt was created refuses execution instead of treating the
stale approval as authority.

**Suspended on tool execution (`suspend(data)`)**

After hydration: `pendingSuspension` is rehydrated — the *separate* persisted
shape (§5.1), not a relabelled `pendingApproval`. The workflow snapshot
survives. The external resumer (webhook handler, operator, etc.) calls
`respondToToolSuspension({ itemId, resumeData })`; harness resumes through the
§4.2 Required Agent Resume Boundary. The `itemId` is the stable pending
interaction ID; it may mirror `toolCallId` only when §5.1's uniqueness rule
allowed that pending ID. The `resumeData` payload is opaque to the harness and
flows straight back into the paused tool's continuation.

**Recovered active run started with `addTools` or another non-reconstructable per-run executable tool surface (`currentRun.nonRehydratableToolSurface === true`)**

After hydration: Same fail-closed treatment as missing runtime identities:
pending approval/suspension/question/plan fields for the run are dropped, any
matching `InboxResponseReceipt(status: 'accepted')` and channel-originated
`ChannelActionReceipt` are advanced to `failed`/`dead` with row
`error.code = 'tool_surface_unrehydratable'` (bare `HarnessRowErrorCode`,
§4.5d); the run is marked `interrupted` with the same bare row code on
`HarnessRunOperationalState.error.code`. The matching `error` `TurnEvent`
projects through §13.3f.1 and carries `error.code = 'harness.session_corrupt'`
with `error.details.reason = 'tool_surface_unrehydratable'`. Signal-driven
`message(...)`,
`message({ stream: true })`, untyped `useSkill(...)`, and drained `queue(...)`
operations also record `message_failed` / `queue_failed` on their existing
signal/queue result boundary. Typed sync output paths fail closed only through
their run/error surface because v1 defines no signal/queue result lookup or
operation tombstone for them. See the run-correlation bullet above.

**Crash after `pendingSuspension` persisted but before workflow snapshot written**

After hydration: `pendingSuspension` is rehydrated but the run's
`MastraStorage.workflows` snapshot is missing or incomplete. The harness drops
the pending field, emits an `error` event, and the session recovers idle with
the queue continuing normally. The interrupted call's promise rejects. This is
analogous to "pending interrupt with missing workflow snapshot" in Rehydration
failures above.

**Crash after workflow snapshot written but before `pendingSuspension` persisted**

After hydration: The workflow snapshot is durable but the pending UX state is
lost. The harness recovers the run from the agent layer's `runId` / `toolCallId`
/ tool state if still reachable, or marks the run `interrupted` and clears the
active pointer so the thread can resume idle. The suspended turn cannot be
resumed because there is no `pendingSuspension` to feed
`respondToToolSuspension`.

**Crash after suspension and `respondToToolSuspension` accepted but resume not yet applied**

After hydration: Same as the inbox-response recovery above:
`InboxResponseReceipt(status: 'accepted')` is rehydrated, `currentRun.status`
stays `resuming`, and recovery retries the resume with the same `responseId` /
`resumeAttemptId` through the §4.2 Required Agent Resume Boundary. The
in-process race before a crash is the same retryable
`HarnessRecoveryDeferredError` path. If a legacy or drifted receipt is found for
a `tool-suspension` path that no longer supports idempotent resume, recovery
terminalizes the receipt with an unsupported-resume error instead of calling a
non-idempotent resume path.

**`ask_user` outstanding**

After hydration: `pendingQuestion` is rehydrated. Responding via
`respondToQuestion(...)` resumes the underlying agent turn.

**`submit_plan` outstanding**

After hydration: `pendingPlan` is rehydrated. Responding via
`respondToPlanApproval(...)` resumes and (if approved) flips the session's mode.

**Crash during bounded close (`closingAt` persisted, `closedAt` absent)**

After hydration: The closing marker is authoritative. Normal hydration, new
admissions, inbox responses, goal continuations, queue drain, wakeup admission,
and outbox projection for the closing session fail with
`HarnessSessionClosingError` or skip the session. A subsequent
`closeSession(...)` owner resumes the same cascade, skips already-closed
descendants, uses the stored `closeDeadlineAt`, and either waits the remaining
deadline or proceeds directly to terminal close if the deadline has passed. The
§5.5 close owner records failed outcomes for queued items that never crossed the
signal boundary and unresolved accepted signal-driven work, closes bindings with
`closedReason: 'session_closed'`, writes each remaining `closedAt` bottom-up
with the close target last, evicts local memory only after the corresponding
durable `closedAt`, and releases the parent/root lease authority only after the
close target's `closedAt` commit or after another owner fences it.

**Delete fence committed before dependent cleanup finished**

After hydration: The session is already terminal to public APIs: hydration, new
admissions, duplicate/result lookups, inbox responses, wakeup admission, and
outbox projection fail as deleted or tenant-hidden. Retrying
`deleteSession({ force: true })` or the adapter's delete reconciler resumes the
§5.5 cascade, terminalizes any remaining source-specific rows with
`session_deleted`, hides/removes tombstones, releases attachment refs, completes
reconstructable per-session workspace cleanup or records the §5.5
abandoned-operator-cleanup fallback, and removes the `SessionRecord` last.
Recovery workers that find terminalized rows return stored terminal duplicate
status or skip them; they must not loop on a missing session lease.

**Reconstructable background task worker crashed mid-execution**

After hydration: The `BackgroundTaskReconstructableRow` remains `running` with
its previous claim until `claimExpiresAt` passes according to storage time. A
recovery worker may reclaim it only after that expiry, then re-resolves
`executorRef` and `completionPolicyRef` against §9 before executor start.
Missing or mismatched refs fail closed under the new claim instead of executing
a fallback closure or treating the raw task row as completed.

**Mid-flush (storage transaction)**

After hydration: The transaction either committed or it didn't. At-least-once
for queue items applies as above.


**Run correlation state.** `SessionRecord.currentRun` is a narrow projection of
the active or recently interrupted Harness operation: run id, trace id,
resource/thread/session ids, the committed mode/model surface, source ids such
as `signalId`, `queuedItemId`, `ChannelInboxItem.id`, `responseId`, pending item
ids, and terminal/error metadata when the session owns that transition. It is
useful for `getCurrentRunId()`, `getCurrentTraceId()`, override conflict errors,
display reconstruction, and deterministic outbox/status projection after
restart. It is not a broad run ledger, not a durable event stream, and not the
external integration durability boundary.

On hydration, the session owner reconciles `currentRun` before accepting new
durable mutations:

- It validates the persisted runtime identities (`modeId`, `agentId`, `modelId`,
`toolIds`, `mcpBindingIds`, workspace provider) against current config. For a
non-terminal `currentRun`, `modeId` is the committed run mode, which may differ
from the session's default `SessionRecord.modeId` because of a per-turn override
or skill `defaultMode`; the current config must still contain that mode, that
mode must resolve to the persisted `agentId`, and that agent must still be
registered. Missing modes/agents/models/tools, changed mode-to-agent bindings,
MCP bindings absent from current config, or workspace-provider mismatches fail
closed: the harness does not call the agent with a silently reduced or
retargeted runtime surface. Persisted tool identity validation accepts only
stable registry/config identities; tool names, schemas, metadata-only snapshots,
or same-named registered fallback tools are not proof that the original
executable surface survived. Direct non-durable runs are marked
interrupted/failed, queued admissions stay retryable or fail their
`QueueAdmissionReceipt` according to policy, and source-specific rows such as
channel inbox/action/wakeup items retry or dead-letter for operator repair. MCP
connection health (`connecting`, `connected`, `failed`), transport handles, HTTP
MCP session IDs, tool counts, resource subscriptions, elicitation handlers,
progress callbacks, config paths, and stderr buffers are diagnostics for the
local/operator control plane unless a future source-specific provider persists
them; they do not weaken this fail-closed identity check and do not become
Harness recovery state by themselves.
- It checks `currentRun.nonRehydratableToolSurface` (§5.1). When `true` on a
non-terminal run (`starting`, `running`, `waiting`, or `resuming`), the run's
tool surface was bound to process-local executable tools that did not survive
restart, registry loss, or cache eviction. That includes `addTools` closures and
any compatibility path that admits per-run toolset/client-tool closures without
stable persisted tool identities. The harness fails closed by the same path as
missing runtime identities before model, processor, resume, or tool-call
execution for that run: any persisted `pendingApproval` / `pendingSuspension` /
`pendingQuestion` / `pendingPlan` for the run is dropped; any matching
`InboxResponseReceipt(status: 'accepted')` for the run is advanced to `failed`
with row `error.code = 'tool_surface_unrehydratable'` (bare
`HarnessRowErrorCode`, §4.5d) and the resume retry described below is *not*
attempted; `currentRun.status` is set to `interrupted` with the same bare
row code on `HarnessRunOperationalState.error.code`; the `error` `TurnEvent`
projects through §13.3f.1 and is emitted with
`error.code = 'harness.session_corrupt'` and
`error.details.reason = 'tool_surface_unrehydratable'` so subscribers can
distinguish this from the missing-snapshot or runtime-identity branches; and
any affected operation that already has a signal or queue result boundary
records `message_failed` / `queue_failed`. Channel-originated responses also
advance their `ChannelActionReceipt` to `failed`/`dead` with row
`lastError.code = 'tool_surface_unrehydratable'` (bare `HarnessRowErrorCode`,
§4.5d). Typed sync output and typed
skill calls still have no retry-safe result lookup, admission tombstone, or
automatic retry path in v1 (§15.1). The flag is
per-`HarnessRunOperationalState`, so a parent run flagged non-rehydratable does
not propagate to subagent child runs.
- It resolves the workspace according to §2.7 before accepting
workspace-dependent runtime work. For persisted `per-session` workspaces, the
recovery path first checks `SessionRecord.workspace.lostAt`; when set, it
fails closed with `HarnessWorkspaceLostError` (using the stored `lostReason`
when present) without reading `state` or calling `provider.resume(...)` —
the `lostAt`-first ordering prevents a stale `state` blob from being fed to
a provider that has already abandoned the workspace. When `lostAt` is unset
and `durability` is `'durable'`, recovery uses the persisted
`SessionRecord.workspace.state` and optional `generation` with
`provider.resume(...)`; `provider.create(...)` is never a recovery path for
an existing active session. Provider mismatch for a durable workspace uses
`HarnessWorkspaceProviderMismatchError`. Missing durable state, permanent resume
failure, destroyed provider generation, or a previously materialised ephemeral
workspace after restart/eviction fail closed with `HarnessWorkspaceLostError`;
for stored `durability: 'ephemeral'`, this workspace-lost branch runs before any
provider-id matching, including factory-shorthand diagnostic IDs. Direct
interactive work fails immediately; queued/channel/wakeup work remains retryable
or dead-letters according to the owning source row because the session owner
cannot rebuild the required runtime surface. Transient provider unavailability
may retry, but the harness still must not run the agent with a substitute
workspace.
- It validates `currentRun.runtimeCompatibilityGeneration` against
`HarnessConfig.runtimeCompatibilityGeneration` for non-terminal runs. When the
run snapshot carries a generation and the current config generation differs —
including when the run has one but current config omits it — the runtime surface
has drifted. The harness fails closed by the same path as missing runtime
identities: any persisted `pendingApproval` / `pendingSuspension` /
`pendingQuestion` / `pendingPlan` for the run is dropped; any matching
`InboxResponseReceipt(status: 'accepted')` for the run is advanced to `failed`
and any channel-originated `ChannelActionReceipt` is advanced to `failed`/`dead`
with row `error.code = 'runtime_dependency_drifted'` (bare
`HarnessRowErrorCode`, §4.5d); `currentRun.status` is set to `interrupted`
with the same bare row code on `HarnessRunOperationalState.error.code`; the
`error` `TurnEvent` projects through §13.3f.1 and is emitted with
`error.code = 'harness.runtime_drift'` and `error.details.missingRefs` /
`error.details.driftedRefs` populated when known; and per-signal terminal
correlation records
`message_failed` / `queue_failed` for the affected operation. When the run
snapshot has no generation, hydration falls back to ID-only validation (legacy
behavior). The guard applies per-run and does not clear `pendingQueue`: after
`currentRun` is terminalized, subsequent queued items drain under the current
config generation.
- It rebuilds `currentRun.pendingItems` from the authoritative pending fields on
  `SessionRecord`; persisted quick-inspection entries that are extra, missing,
  or wrong-kind are ignored.
- If exactly one persisted pending approval/suspension/question/plan points at
the same `runId`, `currentRun.status` becomes `waiting` and the pending item
field remains authoritative. If more than one points at the same `runId`, the
corrupted pending-state branch above runs before snapshots, pending inbox
projection, outbox prompt projection, or response routes expose the ambiguous
state.
- If an accepted `InboxResponseReceipt` exists for the run, `currentRun.status`
remains `resuming` and recovery retries the resume with the persisted
`resumeAttemptId` through the §4.2 Required Agent Resume Boundary before
exposing the run as idle. If the boundary returns the same attempt as already
applied, recovery records `applied` without resuming the run again; if the
pending kind is unsupported, recovery terminalizes the receipt instead of
attempting a weaker resume.
- If a queue receipt is `queued`, `admitting`, or retryable `admission_failed`
and has no `signalId`, queue recovery retries the same admission key. If it is
`accepted` with `runId` / `signalId`, recovery reconciles that accepted run and
`currentRun` must not convert it into a fresh signal.
- If an active goal exists, recovery compares the latest assistant-turn cursor
  with `GoalState.lastDecision.source`. A matching receipt is honored before
  any new judge call, including repairing a missing continuation queue append
  with the stored `continuation.admissionId`.
- If the agent/thread store proves the run completed or failed, the owner writes
terminal metadata and clears the active pointer when no pending interaction
remains.
- If neither pending state nor agent-layer liveness can justify continuing a
non-terminal `currentRun`, the owner marks it `interrupted`; direct interactive
messages that were not yet signal-accepted before the crash keep the weaker
pre-acceptance durability semantics described above, while accepted signals
still follow the terminal result rules in this section.
