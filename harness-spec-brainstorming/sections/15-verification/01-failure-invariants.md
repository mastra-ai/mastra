### 15.1 Failure Invariants

**Direct interactive `message(...)`**

Authoritative record: Agent signal boundary plus optional `admissionId` and
`OperationAdmissionTombstone`

Promise: No Harness pre-admission ledger. Exact accepted-signal retries de-dupe
by `admissionId` while the required signal/tombstone evidence is retained;
terminal settlement is by `signalId` through `message_completed` /
`message_failed` or result lookup, and unresolved accepted signals settle
terminally on close/interruption/unrecoverable expiry rather than staying
pending. After the compact tombstone expires or is deleted, duplicate admission
IDs are no longer recognized. Callers that need pre-acceptance restart survival
use `queue(...)`.

**Direct untyped `useSkill(...)`**

Authoritative record: Agent signal boundary after deterministic skill expansion
plus optional `admissionId` and message-shaped `OperationAdmissionTombstone`

Promise: Exact duplicate retries de-dupe by `admissionId` before the fail-fast
busy check while retained signal/tombstone evidence exists. The admission hash
uses the §4.4 untyped skill hash inputs, validated through the §5.1 stable-hash
canonicalization profile. Same key with changed hash inputs conflicts; after
tombstone expiry the key is no longer recognized.

**Direct sync structured output and typed `useSkill(...)`**

Authoritative record: No retry-safe admission record in v1

Promise: `message({ sync: true, output })` and `useSkill({ output })` call the
sync generate path, reject `admissionId`, do not create operation tombstones,
and must not be automatically retried by SDK or server middleware after
ambiguous transport failure. Retrying these calls can start duplicate runs until
a future generate-admission receipt specifies in-flight duplicate, retention,
compaction, and post-tombstone behavior. Successful public results are the
projected typed JSON value only: implementations that use current
`Agent.generate(..., { structuredOutput })` unwrap `FullOutput<T>.object` and
must not expose the `FullOutput` wrapper, `AgentResult`, usage, metadata, or
trace fields as the local return value or HTTP success body. A missing or
`undefined` object, structured-output validation failure, `fullOutput.error`,
tripwire, model failure, or required approval/suspension/question/plan interrupt
is terminal for that sync call and maps to a Harness error rather than creating
pending inbox state, result-lookup evidence, or retry-safe receipts.

**Direct `queue(...)`**

Authoritative record: `QueuedItem` plus `QueueAdmissionReceipt` and
`OperationAdmissionTombstone`

Promise: At-most-one queue append for one
`(sessionId, admissionId, admissionHash)` while the receipt or tombstone
required by retention policy is retained; at-least-once signal admission before
acceptance; after acceptance, recovery reconciles by `signalId` / `runId`
instead of creating a second accepted signal. Terminal settlement is by
`queuedItemId`, with drained `signalId` recorded once accepted. After the
compact tombstone expires or is deleted, duplicate admission IDs are no longer
recognized.

**Harness storage namespace**

Authoritative record: `harnessName` on independently loadable Harness-domain
records plus a bound `HarnessStorage` view

Promise: The registered Harness name is durable identity, not only route
metadata. Two harnesses sharing one physical adapter cannot hydrate, list,
claim, tombstone, delete, project, or deliver each other's sessions, threads,
messages, attachments, channel rows, wakeups, or tombstones. Unsupported
unscoped adapters fail init when shared by multiple registered harnesses instead
of relying on ID-generation luck.

**Legacy thread bootstrap**

Authoritative record: Legacy `HarnessThread` metadata plus the active
`SessionRecord`

Promise: Opening a legacy thread through the v1 subpath is lazy, tuple-scoped
bootstrap, not eager storage conversion. Existing active v1 records win over
legacy metadata. New active records seed only valid fields whose canonical owner
defines a deterministic bootstrap rule; malformed, ambiguous, unsupported, or
ownerless legacy fields are preserved and ignored for v1 runtime state. V1
mutators preserve unknown top-level legacy metadata and never consult
`metadata.app` for runtime state.

**Shared thread/message log**

Authoritative record: Harness-scoped `MemoryStorage` thread/message rows exposed
through the Harness adapter

Promise: Harness does not maintain a second durable conversation log. Accepted
user/assistant message commits from `message(...)`, drained `queue(...)`,
channel ingress, wakeups, and recovered runs append through one shared message
path inside the bound Harness namespace. `Session.listMessages(...)`,
`MessageHistory`, `SemanticRecall`, thread-scoped `WorkingMemory`,
observational-memory message scans, display reconstruction, and outbox
projection read the same scoped thread/message rows as applicable. A
Harness-only mirror table or best-effort dual-write is not a recovery boundary;
duplicate message IDs with different normalized payloads conflict inside the
same Harness namespace.

**Observational memory public boundary**

Authoritative record: `ObservationalMemorySnapshot` projected from scoped
MemoryStorage OM rows plus `SessionRecord.observationalMemory` config

Promise: OM is advisory context, not operation proof. Public local and remote OM
reads return only the JSON-safe snapshot projection after the session/resource
check; raw OM rows, raw config blobs, metadata, buffered chunks/reflections,
history generations, provider clients, live model objects, functions, locks, and
processor internals never cross the Harness API. OM model switches are ordinary
session-config writes under the session lease/version and do not mutate raw
memory rows. Deleting one session leaves OM rows intact; deleting a thread
clears only thread-scoped OM for that verified
`(harnessName, resourceId, threadId)`, while resource-scoped OM survives
single-thread deletion.

**Thread clone graph**

Authoritative record: `HarnessThread` plus shared thread/message rows

Promise: `threads.clone(...)` creates a new thread in the same
`(harnessName, resourceId)` namespace and copies the full committed source
message history as a point-in-time snapshot with fresh message IDs. It never
copies `SessionRecord` state, active runtime ownership, queue/admission
receipts, pending items, channel bindings, channel inbox/action/outbox rows,
wakeups, operation tombstones, per-session workspace state, or
memory/observational-memory rows. Cloned messages with `PersistedAttachment`
refs keep the original `ownerSessionId`, `attachmentId`, and `sha256` as guarded
message-history references; if the adapter cannot resolve every ref to matching
bytes and register those cloned message refs atomically with the clone, clone
rejects before creating dangling history.

**Display snapshot**

Authoritative record: `SessionRecord.displayState` as
`HarnessDisplayStateSnapshotV1` plus authoritative session/message records

Promise: Display state is a JSON-safe render cache, not a durability ledger or
event replay stream. Public display reads, display-state subscriptions,
persisted snapshots, and HTTP session snapshots use the same
`HarnessDisplayStateSnapshotV1` shape. Missing, malformed, stale, or
newer-version snapshots are ignored and rebuilt from authoritative
pending/currentRun/queue/thread/message state; they cannot resurrect consumed
pending items, settle operations, or synthesize missed SSE events.

**Durable attachment input graph**

Authoritative record: `PersistedAttachment` refs (§5.1) plus guarded attachment
storage (§5.2)

Promise: Verifies that every durable record carrying `PersistedAttachment[]`
references Harness-owned bytes with owner/session identity plus size/digest
metadata, that URL inputs and provider temporary URLs follow §13.7 before the
durable write or reject before admission, that caller deletion is rejected while
durable references remain including cloned message-history refs, and that
recovery or history/context reads fail the owning operation/read with an
attachment-unavailable error when a referenced attachment is missing or
digest-mismatched.

**Goal judge/continuation**

Authoritative record: `SessionRecord.goal.lastDecision` plus
`QueueAdmissionReceipt`

Promise: At-most-one committed judge decision for one
`(goalId, source assistant turn)`. Recovery loads the judge receipt before
calling the judge and repairs a missing `continue` queue append with the same
`continuation.admissionId`. Once the continuation queue receipt exists, ordinary
FIFO queue admission/replay owns ordering, duplicate suppression, and terminal
settlement. Paused, cleared, replaced, already-judged, or source-turn-superseded
goals reject stale in-flight judge results by goal revision and latest durable
assistant-turn cursor.

**Channel ingress**

Authoritative record: `ChannelInboxItem`

Promise: Provider retries cannot create a second Harness admission for the same
idempotency key/hash. Same key with a different payload hash is a conflict.
Live-session capacity pressure during owning-session hydration or admission is
retryable on the same row with the same `admissionId`; exhausted attempts
terminalize to `dead` with row `lastError.code = 'live_session_limit'` (bare `HarnessRowErrorCode` per §4.5d; wire surfaces project through §13.3f.1 to `harness.live_session_limit`).

**Channel action token**

Authoritative record: `ChannelActionToken`

Promise: Rendered button/form tokens are durable before first use. Prompt
projection create-or-loads the same token row for one pending item and binding
generation, reuses the same `actionTokenId` and stable transport rendering after
restart, and evaluates the row's expiry/revocation plus deployment-owned
audience policy before creating any first-use receipt. A retained compatible
receipt remains replayable after token expiry, revocation, or policy changes.

**Channel action**

Authoritative record: `ChannelActionToken`, `ChannelActionReceipt`, plus
`InboxResponseReceipt` and the §4.2 Required Agent Resume Boundary

Promise: One response wins per `actionTokenId`; after provider verification and
durable token-row lookup, duplicate callbacks load any compatible existing
receipt before current token policy/expiry/revocation is applied as a first-use
gate. Retries resume with `responseId = receipt.id` and cannot answer the same
pending item twice because the resume boundary de-dupes by
`resumeAttemptId = responseId`. Live-session capacity pressure during
owning-session entry is retryable on the same receipt with the same
`responseId`; exhausted attempts terminalize to `dead` with row
`lastError.code = 'live_session_limit'` (bare `HarnessRowErrorCode` per
§4.5d; wire projection is `harness.live_session_limit`) without changing
first-response conflict semantics.

**Pending inbox response**

Authoritative record: Pending item field plus `InboxResponseReceipt` and the
§4.2 Required Agent Resume Boundary

Promise: `itemId`, `kind`, `runId`, and `requestedAt` identify one pending
occurrence. On wire calls, `responseId` (SDK auto-generated when the caller
omits it) provides idempotent retry safety only for pending kinds whose resume
path supports `resumeAttemptId = responseId`; the same `responseId` and
`responseHash` return the first applied result or current accepted status
without resuming twice. For tool-suspension, a response that has committed
`accepted` but cannot yet observe the workflow snapshot throws/returns
`HarnessRecoveryDeferredError` / `harness.recovery_deferred` and retries with
the same `responseId`. Unsupported resume kinds fail closed before the pending
item is consumed. Stale, consumed, missing, wrong-kind, or closed-session
responses fail closed.

**Per-run pending interaction slot**

Authoritative record: Four pending fields on `SessionRecord` plus
`currentRun.runId`

Promise: Within one owning session and one non-terminal run, at most one of
`pendingApproval` / `pendingSuspension` / `pendingQuestion` / `pendingPlan` may
reference that run. Registration and harness-authored approval gates check the
slot under the session lease before durable write, so parallel attempts see one
winner and the rest fail with `HarnessBusyError`. Hydration, pending inbox
projection, outbox prompt projection, and response routes treat multiple pending
fields for the same run as `pending_state_corrupt`; they do not choose one item
to resume or render. The matching `SuspensionEvent.tool_approval_required` /
`tool_suspension_required` / `question_pending` / `plan_approval_required`
event emits only **after** the pending row commits under the session lease;
the §10.0 chunk-to-event projection (`tool-call-approval`,
`tool-call-suspended`) must not surface a pending requirement that the
session lease has not yet recorded.

**Channel outbox**

Authoritative record: `ChannelOutboxItem`

Promise: No duplicate row for one `(bindingId, idempotencyKey)`: exact duplicate
enqueue requires the same `payloadHash`, snapshotted operation identity, and
snapshotted `deliverySemantics`; same-key/different-payload,
same-key/different-operation, or same-key/different-mode enqueues conflict.
Duplicate provider-visible sends are prevented only for rows whose
operation-specific `deliverySemantics` is `native-idempotency`,
`client-message-id`, or `lookup-reconcile`. Other rows are explicitly
at-least-once.

**Outbox projection**

Authoritative record: Durable session/thread/run state plus deterministic outbox
keys

Promise: Missing outbox rows for committed assistant outputs, pending prompts,
inbox resolutions, recoverable file references, status, or durable tool-result
summaries are recreated idempotently. File references are stable source
references, not artifact fetch handles (§11.5, §15.3). Live-session capacity
pressure while hydrating a session for projection skips that session for the
current pass and retries later without marking existing outbox rows `failed` or
`dead`. Live deltas, typing, SSE buffers, live-only file chunks, and
non-persisted progress are not reconstructed.

**Agent-produced output artifacts**

Authoritative record: Committed messages, tool results, workspace state, and
application datastore references; no first-class `HarnessArtifact` row in v1

Promise: Invariant form of the §11.5/§15.3 deferral: Harness does not infer
produced artifacts from arbitrary workspace mutations and does not expose
portable artifact list/fetch APIs or `artifact_*` events. A generated file is
recoverable for display or channel projection only when an existing durable
source records a stable reference and the owning product/adapter can still fetch
or render it under its own authorization policy. A2A protocol artifacts and
current live channel file forwarding are protocol/runtime-specific behavior, not
a Harness storage boundary.

**Scheduled/proactive wakeup**

Authoritative record: `HarnessWakeupItem`

Promise: A due fire cannot disappear between schedule claim, pubsub publish,
workflow start, and session queue admission. Recovery claims due, failed, or
stale-claimed wakeups and queues with the same `admissionId`. Binding-backed
channel wakeups validate the stored `bindingId` and `bindingGeneration` before
queue admission, copy external target identifiers from the active
`ChannelBinding`, and fail closed or run as explicitly non-channel work when the
binding is missing, replaced, closed, or undeliverable; they never synthesize
platform thread IDs.

**Session creation**

Authoritative record: Active `SessionRecord` uniqueness on
`(harnessName, resourceId, threadId)` plus `createOrLoadActiveSession`

Promise: Concurrent cold starts for one thread/resource inside one Harness
namespace resolve to one active row. Closed rows do not block reuse, and no
blind read-miss/create race can create duplicates or cross into another Harness
namespace.

**Subagent depth cap**

Authoritative record: Stored `parentSessionId` chain plus
`HarnessConfig.sessions.maxSubagentDepth`

Promise: New descendant creation is capped from the persisted parent chain
before any child `SessionRecord`, thread, workspace, pending item, or
`subagent_start` event is created. The built-in `subagent` tool reports overflow
as a recoverable tool-result failure with
`code = 'harness.subagent_depth_exceeded'`; direct local session resolution and
wire `/sessions` requests with `parentSessionId` reject with
`HarnessSubagentDepthExceededError` / `harness.subagent_depth_exceeded`.
Existing descendant sessions that were valid when created remain addressable
after a later cap decrease, but cannot spawn further descendants beyond the
current cap.

**Session writes**

Authoritative record: `SessionRecord` lease and version

Promise: One live owner mutates a session at a time. Subagent rows have no
independent lease and route writes through the parent/root's lease (§5.6, §5.8);
the "one live owner" promise applies to the active subtree under the root
parent's lease, and `closeSession` (§5.5) is the only path that terminates
descendant rows. Stale session owners and cross-resource callers cannot mutate
state silently.

**Live session residency and eviction**

Authoritative record: Live session map plus `SessionRecord` lease/version

Promise: Finite `sessions.maxLive` pressure eviction uses least-recently-active
order, flushes dirty state before cache drop, skips pinned pending-interrupt
sessions and parent/root owner subtrees with pinned live descendants, treats
mid-flush or storage-error sessions as unflushable, and rejects direct
`harness.session(...)` acquisition with `HarnessLiveSessionLimitError` when no
safe eviction candidate exists. Idle eviction follows the same pin and flush
rules. `session_evicted` is emitted only after the process-local cache entry is
dropped and the lease is released; later `harness.session({ sessionId })`
rehydrates the active, unclosed record transparently.

**Subtree lease renewal**

Authoritative record: `SessionRecord` parent/root lease plus descendant lease
entries

Promise: Parent/root renewal is Harness-successful only when
`renewSessionLeaseSubtree(...)` renews the parent/root row and mirrors the same
storage-authoritative expiry to every active descendant row in the bound Harness
namespace. A parent-only renewal or partial descendant mirror cannot be reported
as success; the owner treats failure as lease loss and stops mutation, queue
drain, pending-item resume, outbox projection, and provider-visible work before
child writes can split from parent ownership.

**Bounded session close**

Authoritative record: `SessionRecord.closingAt` / `closeDeadlineAt`, session
lease, and `closedAt`

Promise: Close is a two-phase bounded transition. Entering Closing reserves the
active `(harnessName, resourceId, threadId)` key, rejects new
admissions/resumes/inbox writes/descendant creation with
`HarnessSessionClosingError`, and aborts live work across the active subtree.
`closeSession` resolves only after terminal `closedAt`; if live work ignores
abort past `closeDeadlineAt`, unresolved accepted/queued work is recorded
failed, late process-local writes are fenced by version/closing checks, bindings
close with `session_closed`, each session's `closedAt` is written before local
eviction, and the parent/root lease authority is released only after the close
target's `closedAt` commit or after another owner fences it. A crash after
`closingAt` resumes idempotently from the stored deadline; storage must not
expose a voluntarily released, half-terminal Closing record whose `closingAt` is
present and `closedAt` absent.

**Remote state PATCH**

Authoritative record: `SessionRecord.version` exposed as state/session `ETag`
plus the active session lease

Promise: Remote object-form state patches are accepted only when `If-Match`
matches the current session version at the state-mutation queue point. A stale
validator fails with `harness.state_conflict` before merge, serialization
validation, `state_changed`, or durable state commit. The merge uses the §5.1
top-level algorithm: omitted keys unchanged, explicit `null` stored, arrays and
nested objects replaced as whole values, and no delete-by-patch. The validator
is session-level, so intervening non-state durable writes can conservatively
force clients to refetch and recompute.

**Thread app metadata**

Authoritative record: `HarnessThread.metadata.app` plus `SessionRecord.version`
/ active session lease

Promise: Public `setThreadSetting` writes only one app-owned `metadata.app[key]`
entry after resource, lease, key, reserved namespace, and canonical-JSON
validation. It preserves all top-level metadata and unrelated app keys, rejects
attempts to write Harness/Mastra/Memory/channel/legacy names, advances the
session version on commit, and never affects session hydration, mode/model, OM
config, token usage, channel routing, subagent ownership, or thread title/list
labels. Remote writes require `If-Match` and reject stale validators before
touching thread metadata.

**Principal authorization**

Authoritative record: Mastra Server route metadata / RBAC / FGA policy plus
channel action token audience

Promise: Resource lookup proves tenancy only. Privileged wire fields (`yolo`),
inbox approvals, permission mutation, state/config/goal/close operations, and
operator/internal routes require the explicit §13.2 route-principal capability
class before mutation or admission. Channel action callbacks create first-use
receipts only after provider verification and deployment-owned token-audience
authorization for the verified actor; compatible existing receipts remain
replayable.

**Tool approval precedence**

Authoritative record: `SessionRecord.permissionRules`,
`SessionRecord.sessionGrants`, per-run `yolo`,
`HarnessConfig.defaultPermissionPolicy`, and snapshotted
`ToolApprovalReasonSource[]` on `PendingApproval`

Promise: Tool approval decisions are deterministic, monotonic, and owned by the
session whose run attempted the tool call. Route/resource/principal
authorization succeeds first and cannot be bypassed by grants or `yolo`. The
effective policy rule is per-tool, then category, then configured default, then
fallback `ask`; an effective `deny` is terminal and beats grants, `yolo`, and
tool-owned approval reasons without creating `pendingApproval`.
Static/global/mapped approval requirements add `tool-config`, function-valued
approval callbacks add `tool-fn` only on `true` or fail-closed throw/reject, and
policy `ask` adds `policy`; grants, effective `allow`, and `yolo` can skip only
the `policy` reason, not tool-owned reasons. Pending approval responses consume
one item and do not mutate grants, rules, or the snapshotted reasons.

**Harness auth transport**

Authoritative record: Mastra Server route metadata, primary auth provider state,
and optional server-issued event subscription-token state

Promise: Client-facing Harness routes authenticate primary credentials only
through `Authorization: Bearer ...` or deployment-secure cookies, never through
bearer/API-equivalent query parameters. The sole query-token exception is an
opaque, short-lived, route-scoped token for `GET /sessions/:sessionId/events`;
it is scoped to one `(harnessName, resourceId, sessionId, events route)`,
rejected on all other routes, not persisted in request context or admission
hashes, not forwarded as `mastra__authToken`, and not replaced by
`Last-Event-ID`. Expired, revoked, malformed, or cross-scope event subscription
tokens fail before any SSE bytes are written.

**Background task observation**

Authoritative record: Auth-derived `(harnessName, resourceId)` plus task owner
fields or owning Harness durable row

Promise: Client-facing background-task list, get, and live event routes never
trust caller-supplied `resourceId`. They apply every secondary filter inside the
auth-derived scope, compute totals and snapshots after scoping, and post-load
check direct task IDs before returning task metadata, args, results, errors,
`threadId`, `runId`, or `resourceId`. Missing, cross-harness, cross-resource,
and unscopable task rows return tenant-safe not-found or empty scoped results
for ordinary clients; unscoped or cross-resource observation is operator-only.

**Durable work status read model**

Authoritative record: Existing source-specific rows and result boundaries
projected into `SessionListItem.durableWork` / `SessionSnapshot.durableWork`

Promise: The work-status read model is a bounded, redacted projection only. It
does not create a generic work ledger, route, event stream, or storage table;
does not expose raw payloads, request context, provider receipts, token
material, claim IDs, hashes, or unredacted error messages; and does not settle
SDK promises. Queue receipts, wakeup rows, channel inbox/action/outbox rows,
inbox response receipts, goal decision receipts, accepted-signal result
evidence, and qualified reconstructable background-task rows remain
authoritative. A raw background-task row with `status: 'completed'` alone is
never proof of Harness-visible or provider-visible completion.

**Channel diagnostic read**

Authoritative record: Auth-derived `(harnessName, resourceId)` plus redacted
channel ledger summaries

Promise: Client-facing channel diagnostics never trust caller-supplied
`resourceId` and never expose raw channel ledger rows. They verify the addressed
session first, apply every binding/inbox/action/token/outbox filter inside that
session's resource scope, and return only redacted summaries whose trusted owner
fields prove the route Harness namespace plus the authenticated resource and
addressed session or descendant ownership. They are side-effect-free: no
claiming, claim renewal, outbox projection, retry, migration, retargeting,
terminalization, or provider-visible work. Deleted-session rows are hidden from
ordinary clients, while channel-wide/cross-resource/worker diagnostics are
operator-only.

**Session delete**

Authoritative record: `SessionRecord` subtree plus dependent queue,
inbox/action/outbox, wakeup, tombstone, attachment, binding, and workspace rows

Promise: The §5.5 delete lifecycle allows non-force delete only for closed
sessions whose descendants and dependent source rows are terminal; otherwise it
fails with `HarnessSessionDeleteBlockedError`. Force delete installs a delete
fence, terminalizes retryable dependent rows with `session_deleted`, closes
bindings without retargeting, hides/removes tombstones before the session
disappears, force-removes abandoned attachment refs, handles descendant sessions
bottom-up, and leaves workers with terminal rows rather than missing-session
retry loops.

**Workspace recovery**

Authoritative record: `SessionRecord.workspace` for `per-session`; configured
external workspace identity for `shared` / `per-resource`

Promise: Existing active sessions never resume against a silently substituted
workspace. Durable per-session workspaces resume through the stored provider
state; provider `onStateChange` recovery-state updates commit under the owning
session lease before the provider treats them as recoverable; ephemeral or lost
workspaces fail closed with `HarnessWorkspaceLostError`; per-resource destroy is
blocked by persisted active sessions for the resource.

**Channel binding**

Authoritative record: `ChannelBinding`

Promise: A platform conversation resolves to one active
`(harnessName, channelId, providerId, resourceId, sessionId, generation)` owner
with durable provider target identifiers. Provider/generation mismatch fails or
dead-letters instead of retargeting. Scheduled/proactive channel-origin context
must reference an active binding; unbound proactive outreach is outside v1
channel delivery.

**Provider callback binding**

Authoritative record: `HarnessProviderCallbackBinding`

Promise: A provider-owned route/install selector maps to at most one active
Harness channel owner before adapter normalization; missing, duplicate,
disabled, unregistered, or legacy-overlapping ownership fails closed during init
or callback resolution.

**Request context**

Authoritative record: §4.4 source precedence plus canonical JSON
`requestContext.app`, trusted integration-created `channel` on queue, inbox,
wakeup, and action paths, and runtime-only `harness`, `MastraMemory`, auth/user,
browser, and `mastra__*` / `__mastra*` slots rebuilt last

Promise: Caller metadata cannot spoof Harness/Mastra/server-owned slots. `app`
and `channel` are top-level siblings, not deep-merged namespaces;
persisted/recovered work uses the operation's stored
`PersistedRequestContextInput` rather than fresh caller input. Runtime-only
slots and identity/linkage fields are omitted from persisted request-context
rows, stable hashes, public read models, activity projections, wire responses,
and client-facing diagnostics. Channel-origin policy must survive `queue`,
`start`, `startAsync`, resume, and recovery. A wrapper that cannot preserve
trusted channel context is not valid for channel-origin work.

**Harness tool context projection**

Authoritative record: Harness-specific tool execution context per §6/§6.3

Promise: Harness-managed tool invocations expose the per-execution
`context.requestContext.get('harness')` slot while `context.mastra` is absent or
an explicit allowlist facade. The facade cannot reach raw storage, deprecated
primitive storage, agent or workflow registries, provider/channel clients,
mutable framework registries, or other session-bypassing framework capabilities.
Non-Harness generic Mastra tool execution remains a compatibility path.

**Runtime dependency rehydration**

Authoritative record: `HarnessRunOperationalState` identities plus current
config, including `nonRehydratableToolSurface` and restricted sandbox command
policy

Promise: Missing modes, missing agents, changed mode-to-agent bindings for the
committed run mode, missing models/tools/MCP bindings/workspace providers,
missing restricted sandbox command policy/configuration, tool identities that
cannot be validated as stable registry/config IDs, or a recovered run whose
original tool surface was bound to process-local executable tools
(`HarnessRunOperationalState.nonRehydratableToolSurface`) fail closed rather
than resuming with a silently changed, retargeted, or partially missing
execution surface.

**Background task execution**

Authoritative record: §9 executor/completion-policy registry plus task claim, or
owning Harness row

Promise: A background task row is not proof of Harness-visible completion. If a
reconstructable task row is the recovery handle, workers claim, renew, resolve
`executorRef` and `completionPolicyRef` against the §9 registry, validate
generations and completion metadata, and terminalize it under the current claim
before any Harness-visible completion or provider-visible side effect is
trusted. Missing, drifted, wrong-kind, or invalid executor/completion refs fail
closed with `runtime_dependency_drifted` rather than executing a substitute
closure. If the worker loses its claim, the owning wakeup/inbox/action/outbox
row or the standalone reconstructable task row remains retryable or
dead-lettered according to its own policy.

**Future MCP/app callbacks**

Authoritative record: Deferred source-specific rows

Promise: v1 does not add a generic MCP/app callback ledger. Until
source-specific rows exist, resumed work must not depend on process-local MCP
client/session objects for correctness; unavailable bindings fail closed or stay
behind an owning durable row.

**MCP runtime status observation**

Authoritative record: Process-local MCP client/provider state

Promise: MCP servers, tools, resources, resource subscriptions, progress
notifications, elicitation handlers, stderr buffers, and HTTP MCP transport
sessions are runtime dependency diagnostics, not Harness sessions, durable work
rows, operation settlement, or callback/effect receipts. Public
`SessionSnapshot`, `SessionListItem`, `SessionRunProjection`, and
`DurableWorkSummary` do not carry a per-binding MCP status inventory in v1. A
local or operator control plane may expose best-effort status such as
`connecting`, `connected`, `failed`, transport, tool count/name summaries,
config paths, bounded logs, and binding presence only as diagnostics unless a
future source-specific provider persists that status and defines its recovery
contract.

**Generic non-read external tool effects**

Authoritative record: Deferred source-specific receipt rows

Promise: Channel outbox/action receipts are v1's provider-visible receipt model.
Other non-read external effects need source-specific lookup-before-execute
receipts before Harness can claim no duplicate provider side effects.


Exactly-once is claimed only at Harness admission/receipt boundaries where a
unique key and stable hash are stored before the downstream side effect.
External
provider effects are exactly-once only when the provider or adapter supports the
operation-specific `deliverySemantics` mode snapshotted on the outbox item.
Otherwise the v1 promise is at-least-once with documented duplicate risk.
