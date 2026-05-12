### 15.2 Focused Test Plan

Implementation acceptance requires narrow tests for these cases or an explicit
deferred-test note when the feature itself is deferred:

Executable coverage rule: each §15.2 row must be testable either directly from
the row or by following the cited owning contract. The acceptance case must
identify the owning section rule, the entry point, route, storage helper, or
worker path under test, the setup or failure injection, the durable evidence or
observable result, the error name / HTTP status / durable terminal status where
the owner defines one, and the replay, retry, restart, or fail-fast assertion
where recovery behavior matters. §15.2 must not add a duplicate route matrix,
DTO map, lifecycle state machine, error code, storage record, or recovery rule;
missing mechanics belong in their canonical owner before a verification row
relies on them. Deferred-test notes cite the owning §15.3 deferral.

**Duplicate inbound channel event with same key/hash**

`createOrLoadChannelInboxItem` and bridge ingress return the existing row/status
without a second session admission.

**Same inbound key with different hash**

Storage and bridge surface a conflict before binding/session mutation.

**Canonical stable-hash determinism**

Storage/server/SDK tests prove `admissionHash`, `payloadHash`, `responseHash`,
and `metadataHash` use the §5.1 Harness stable-hash canonicalization profile:
same normalized DTOs produce identical SHA-256 lowercase hex across adapters,
key order is not locale-dependent, explicit `null` differs from absence, sparse
arrays and non-`JsonValue` inputs reject before durable writes, duplicate raw
JSON member names are not accepted as direct hash material, the channel
missing-ID sentinel cannot collide with provider IDs, and attachment refs hash
stable IDs/digests rather than URLs or process-local paths. Tests also prove
`transportHash` hashes the exact UTF-8 rendered token string/handle.

**Concurrent inbox/action/outbox/wakeup claims**

Storage contract tests show exactly one current owner and stale claims rejected.
Outbox claim tests also prove same-binding FIFO: a later non-terminal row for
one `bindingId` is not claimed or dispatched before an earlier non-terminal row
for that binding has settled, while rows for different bindings may proceed
independently.

**Worker readiness before durable ingress**

Deployment tests prove externally reachable channel inbox/action routes, channel
outbox projection/dispatch scopes, and wakeup-producing schedule/proactive
handoffs return `503 harness.worker_unavailable` with `retryable: true` and safe
scope details until the required worker supervisor initializes, validates
registry/provider/runtime config, reaches the storage scan/claim/renew
operations for its ownership scope, and starts its poll/dispatch loop. A failed
scope does not create, claim, dispatch, or provider-acknowledge new durable work
rows and does not block unrelated scopes or read-only diagnostic routes. Exact
duplicate callbacks that are answered only from stored terminal evidence, inbox
accepted/queued evidence, action accepted/applied evidence, or retained
source-specific duplicate/conflict proof do not count as new durable ingress.

**Route principal authorization**

Server tests prove authenticated resource membership is not enough for
privileged operations: direct `yolo: true`, tool/plan approvals,
`PATCH /permissions`, state/config/goal/close mutations, and operator/internal
dispatch reject with `403 harness.forbidden` before session mutation when the
principal lacks the required §13.2 capability class, with `details.capability`
naming the failed class, while cross-resource session/thread IDs still return
tenant-safe not-found.

**Tool approval precedence**

Session/tool-runtime tests prove the §4.2 order and monotonic source
composition: per-tool rules override category rules, `defaultPermissionPolicy`
fills missing rules, fallback is `ask`, effective `deny` blocks without creating
`pendingApproval` even when `yolo`, grants, or tool-owned approval reasons
exist, grants and effective `allow` skip only the `policy` reason, and `yolo`
converts only policy `ask`. Tests also prove static/global/mapped approval
survives `needsApprovalFn` returning `false`, `needsApprovalFn` returning `true`
adds `tool-fn`, thrown/rejected `needsApprovalFn` fails closed with `tool-fn`,
implementation sentinels for function-valued approval are not double-counted as
`tool-config`, `pendingApproval` / display / `tool_approval_required` snapshots
carry the approval reasons, uncategorized tools are not implicitly allowed,
queued turns replay admitted `yolo` while respecting later effective `deny`,
subagent tool calls use the owning child session's permission rows, and
`respondToToolApproval(...)` does not mutate `SessionGrants`, `PermissionRules`,
or snapshotted approval reasons.

**Runtime tool policy gates**

Tool-runtime tests prove the §4.2 pre-exposure gate runs after static tools,
`addTools`, processors, ToolSearch, workspace wrappers, subagent/forked
composition, `prepareStep`, `activeTools`, and `toolChoice` have produced the
final step surface, and before model/provider execution. Tests prove effective
`deny` tools are absent from `tools` and `activeTools`; forced `toolChoice`
naming a denied or hidden tool rejects with `HarnessForbiddenError`;
unsatisfiable `activeTools` / `toolChoice: 'required'` combinations fail closed;
provider-executed tools with effective `deny` are hidden; provider-executed
tools with remaining approval reasons are hidden unless the provider path
preserves the same pending-approval interrupt; and authorized `yolo` converts
only policy `ask` without suppressing tool-owned approval reasons. Tests also
prove the pre-action gate re-evaluates the owning session's current permission
rows before local execute, approval resume, direct resume, and durable shared
execution, including model-emitted hidden tool calls, permission changes between
exposure and action, recovered pending approvals, and child/forked subagent tool
calls that must use the child session's rows rather than inherited parent
grants, rules, or `yolo`.

**Dynamic tool discovery filtering**

Tool-runtime tests prove dynamic discovery processors such as ToolSearch apply
the §4.2 permission decision before indexing/searching, top-K ranking,
suggestions, exact load responses, loaded-tool cache insertion, and final merge.
Effective `deny` candidates are absent from names, descriptions, counts,
suggestions, loaded status, final merged tools, `activeTools`, and forced
`toolChoice`; exact denied loads return only a generic unavailable result. Tests
also prove candidate identity/category canonicalization, fail-closed behavior
when trusted metadata is insufficient before exposure, loaded-tool/resolver
cache invalidation after permission or session-version mutation, child-session
permission ownership for subagent discovery, and the HC-320 final pre-exposure
gate for provider-executed dynamic tools.

**Active-run `yolo` override conflict**

Session/server tests prove authorized `message({ yolo: true })` on an
already-active run rejects at admission with `HarnessOverrideConflictError` /
`harness.override_conflict` and `conflictingFields` containing `yolo`, including
the stream form before any `AgentStream` or SSE bytes are exposed. Tests also
prove retained exact `admissionId` retries of a previously accepted idle
`message({ yolo: true })` return the original signal metadata instead of
re-running the active-run conflict check, and idle `message({ yolo: true })`,
`queue({ yolo: true })`, and `useSkill({ yolo: true })` still bind the
authorized approval bypass to their fresh run boundary.

**Scoped channel diagnostics observation**

Server/SDK tests prove `GET /sessions/:sessionId/channel-diagnostics` derives
`resourceId` from auth, rejects caller-supplied `resourceId`, post-load checks
every returned binding/inbox/action/token/outbox summary against
`(harnessName, resourceId)` plus the addressed session or verified descendant
relationship, enforces pagination/limits, redacts raw provider payloads, token
strings, action responses, provider receipts, claim IDs, and secrets, and
performs no claims, projections, retries, migrations, retargeting,
terminalization, or provider-visible work. Tests also prove deleted-session rows
are hidden from ordinary clients and channel-wide/cross-resource/worker
diagnostics require operator authorization.

**Auth transport query-token rejection**

Server/SDK tests prove client-facing Harness routes accept `Authorization`
header and deployment-secure cookie auth, reject or ignore
`?apiKey=<main-token>` and equivalent bearer query parameters before principal
resolution, and never write query-derived bearer tokens into
`mastra__authToken`, persisted request context, admission hashes, or downstream
forwarding state. Tests also prove the per-session `/events` route accepts only
valid scoped subscription tokens when that fallback is enabled; rejects expired,
revoked, malformed, cross-resource, cross-session, or wrong-route tokens before
streaming; rejects the scoped token on non-SSE routes; treats `Last-Event-ID` as
replay state only; and SDK reconnect obtains a fresh scoped token through normal
header/cookie auth before resubscribing.

**Scoped background-task observation**

Server/SDK tests prove ordinary background-task list/get/live-event routes
reject caller-supplied `resourceId`, derive scope from auth, return only tasks
matching the authenticated `(harnessName, resourceId)` or a verified owning
Harness row, compute `total` after scoping, filter the running-task stream
snapshot and every later event per resource, and return tenant-safe `404` for
direct task-ID mismatches without leaking task existence. Tests also prove rows
without a trusted owner are hidden from ordinary clients,
unfiltered/cross-resource observation requires operator authorization, and
ordinary SDK helpers do not expose `resourceId` while operator/admin helpers are
explicitly scoped as diagnostics. Tests also cover the v1 diagnostic
projection mapper from §4.8c: `status: 'dead'` is a valid returned and
filterable status, `args` / `result` / `error` may be omitted or redacted by
policy, claim/executor/completion-policy fields and `error.stack` never
cross ordinary client routes, and current raw task rows are not returned
directly through scoped diagnostic routes.

**Claim renewal failure**

Worker tests prove no further session mutation or provider call happens after
renewal failure.

**Session lease timing validation**

Config tests prove `HarnessConfigError` for non-positive `lockTtlMs` /
`lockRenewMs`, `lockRenewMs >= lockTtlMs`, negative `lockWaitMs` /
`flushDebounceMs`, invalid `maxFlushFailures`, missing `sessions.maxClockSkewMs`
when session lease expiry is not storage-authoritative, and
`sessions.maxClockSkewMs >= lockTtlMs - lockRenewMs`. Tests also prove
`lockWaitMs` is only a caller-side budget, and no
`flushDebounceMs <= lockRenewMs` ordering is required because keep-alive renewal
is independent.

**Session lease storage-authoritative time**

Storage contract tests prove initial lease installation,
`acquireSessionLease(...)`, `renewSessionLease(...)`,
`renewSessionLeaseSubtree(...)`, `saveSession(...)` owner-expiry checks,
`lockMode: 'wait'` retries, `lockMode: 'steal'`, and child lease mirroring
compare expiry using storage-authoritative time or the declared bounded skew.
Returned `storageNow` and `expiresAt` come from the same time source.

**Session lease renewal failure**

Session tests prove failed `renewSessionLease(...)` or
`renewSessionLeaseSubtree(...)` marks ownership lost, emits an error, rejects
new admissions/resumes, stops queue drain and provider-visible work, and
requires fresh `harness.session(...)` acquisition before mutation resumes.

**Subtree lease renewal partial failure**

Storage and session tests prove `renewSessionLeaseSubtree(...)` cannot return
parent-only success when any active descendant mirror is missing, stale,
corrupt, or uncommitted. A crash or adapter error between parent/root renewal
and descendant mirror update leaves the owner fenced before further mutations,
queue drain, pending-item resume, outbox projection, or provider-visible work; a
later owner repairs by acquiring the parent/root lease and re-running subtree
renewal before descendant writes continue.

**Stale-owner `saveSession` CAS conflict**

Storage/session tests prove `saveSession(..., { ownerId, ifVersion })` rejects
stale/expired owners and version mismatches distinctly from transient adapter
failures; retry/reapply is allowed only after the same owner proves it still
holds the current unexpired lease.

**Storage error taxonomy consistency**

Storage/session/server tests prove representative failures in session
create/load/save/list/delete/lease, thread metadata, message log, queue,
operation tombstone, inbox response, channel binding, provider callback binding,
channel inbox/action/outbox, wakeup, attachment, and workspace cleanup paths
surface `HarnessStorageError.operation` values from the §4.5 taxonomy;
`storage_error` events and wire `harness.storage` responses carry the same
operation, retryability, tenant-safe identifiers, and optional row subject;
validation, corruption, same-key/different-hash conflicts, stale remote
validators, attachment in-use checks, and provisioning conflicts stay on their
specific Harness errors or terminal row statuses.

**Legacy bootstrap compatibility**

Session/storage tests prove opening a legacy thread with the v1 Harness performs
no eager whole-storage conversion, resolves the thread through
`(harnessName, resourceId, threadId)`, converges concurrent cold opens on one
active `SessionRecord`, seeds only owner-defined valid legacy fields, preserves
unknown top-level legacy metadata and unrelated `metadata.app` keys, ignores
malformed or ownerless fields for v1 runtime state, and uses the existing
`SessionRecord` rather than re-reading legacy runtime metadata on later
hydrations.

**Package export resolution for `@mastra/core/harness/v1`**

Build/package tests prove the §11.1 `./harness/v1` export resolves from the
package entry map in ESM `import`, CJS `require`, and TypeScript declaration
contexts; the runtime builds emit `dist/harness/v1/index.js` and
`dist/harness/v1/index.cjs`; the declaration-generation path emits
`dist/harness/v1/index.d.ts`; the ESM, CJS, and declaration targets expose the
expected v1 public names; and `@mastra/core/harness` continues to resolve to the
legacy Harness implementation throughout `@mastra/core` v1.

**Remote state PATCH stale-write conflict**

Server/SDK tests prove `GET /state` and full-session reads return an `ETag`,
`PATCH /state` rejects missing or malformed `If-Match` with
`harness.validation`, two remote callers that patch from the same validator
cannot both commit, the loser receives `409 harness.state_conflict` with
attempted/current versions, no `state_changed` event or durable state commit
happens on conflict, successful PATCH returns a new `ETag`, and clients can
refetch/recompute to retry. Tests also prove the winning object-form merge
preserves omitted keys, stores explicit `null`, replaces arrays and nested
objects as whole top-level values, rejects delete-by-`undefined` / non-JSON
patch values before commit, and emits `state_changed` with the committed state
plus top-level changed keys. Closed, tenant-mismatched, and lease-lost sessions
use their normal session/lease errors rather than leaking current state
versions, while invalid candidate state still maps to
`harness.state_serialization` only after the validator passes.

**Thread app metadata namespace protection**

Session/server tests prove `setThreadSetting` writes only `metadata.app[key]`,
rejects invalid key grammar, `__proto__` / `prototype` / `constructor`, reserved
top-level names and prefixes, known legacy keys (`currentModeId`,
`currentModelId`, `modeModelId_*`, OM model/threshold keys, `tokenUsage`,
`workingMemory`, channel fields, fork/clone/project metadata), non-JSON values,
and non-object legacy `metadata.app`. Tests also prove successful writes
preserve unrelated metadata, advance `SessionRecord.version`, return a new
`ETag` remotely, reject stale `If-Match` with `harness.state_conflict`, emit no
`state_changed`, and do not alter runtime mode/model, OM config, channel
routing, subagent filtering, token usage, or thread title/list label
projections.

**State serialization vs storage failure**

State mutation and server/SDK wire tests prove non-JSON or lossy candidate state
rejects atomically before commit with non-retryable
`400 harness.state_serialization`, emits no `state_changed`, leaves persisted
state unchanged, and keeps post-validation adapter, lease, or closed-session
failures mapped to `harness.storage` or the relevant session/lease error.
Coverage includes object-form patches, tool-context writes, and functional
full-state replacements with `undefined`, functions, symbols, `BigInt`, `NaN`,
infinities, sparse arrays, class instances, `Date`, `Map`, `Set`, accessors, and
circular references.

**Tool state snapshot immutability**

Tool/context tests prove mutations to `HarnessRequestContext.state`,
`getState()` results, and the functional-updater `prev` snapshot do not alter
canonical session state, do not persist, do not emit `state_changed`, and do not
advance session/state version. Tests also prove committed state is detached from
caller-owned patch objects and updater return objects after `setState` resolves.

**Tool state snapshot staleness**

Tool/context tests prove `HarnessRequestContext.state` remains the context-build
snapshot after intra-turn `setState`, `await setState(...)` followed by
`getState()` in the same tool invocation observes the committed write, and
functional-updater `prev` is based on latest committed session state at mutation
time rather than the context-build snapshot.

**Tool-context identity names**

Tool/context tests prove `HarnessRequestContext.harnessName` equals the owning
`SessionRecord.harnessName` and bound `HarnessStorage` namespace; caller request
context cannot override `harnessName` or `harnessInstanceId`; subagent contexts
preserve the parent/root Harness namespace; channel-origin contexts require
`channel.harnessName` to match the outer `harnessName`; and `harnessInstanceId`
is process-scoped correlation identity only, not a storage key, route key,
persisted resume key, or proof of lease authority.

**Persisted session mutator settlement**

Session/API tests prove permission grants/revokes/policies and goal
set/pause/resume/clear return only after the corresponding `SessionRecord`
mutation commits; permission grants/rules survive eviction and restart from
`SessionRecord.sessionGrants` / `SessionRecord.permissionRules`, revokes remove
only the persisted matching grant, and validation, closed-session, lease, CAS,
and storage failures reject, roll back in-memory state, and emit no commit
event.

**Tool-context pending registration commit semantics**

Tool-runtime tests prove `HarnessRequestContext.registerQuestion(...)` and
`registerPlanApproval(...)` commit the pending item under the session lease
before resolving, and `await suspendTool(...)` commits `PendingToolSuspension`
before the harness-owned interrupt is raised. Validation, closed-session, lease,
CAS, storage failure, non-JSON `suspendData`, or adapter-visible `suspendSchema`
failure rejects before any pending-item event or interrupt, and a second pending
interaction in the same owning session/run rejects with `HarnessBusyError`
before any durable write.

**Tool suspension compatibility adapter**

Tool-runtime and recovery tests prove current Mastra
`context.agent.suspend(...)` / `context.workflow.suspend(...)` compatibility
paths, when enabled for v1 sessions, route through the same §6.1
`suspendTool(...)` lease-gated pending-registration path before workflow
suspension; preserve JSON-safe `resumeSchema` / `resumeLabel` metadata on
`PendingToolSuspension`; keep `requireToolApproval` on the `pendingApproval`
path; pass `resumeData` back to the paused continuation through the §4.2
Required Agent Resume Boundary; reject duplicate parallel
suspension/registration attempts before a second durable write; and survive
restart without relying on legacy process-local pending run/tool IDs.

**Tool-visible abort reason preservation**

Tool-runtime tests prove harness-created tool contexts receive a required
`abortSignal` whose `reason` is a `HarnessAbortedError` with the §4.5 reason for
live `agent_aborted`, `parent_aborted`, `session_closed`, and live
`process_restart` teardown paths. Coverage includes already-aborted signals,
abort-source races before the one-shot signal fires, in-flight
`registerQuestion(...)` / `registerPlanApproval(...)` waits, `suspendTool(...)`
registration, and subagent execution. Tests prove built-in `ask_user`,
`submit_plan`, `suspendTool`, and `subagent` paths preserve `signal.reason`
instead of replacing it with a generic `DOMException`, generic `AbortError`, or
user-abort string on Harness-visible error or settlement surfaces. Tests also
prove durable recovery after restart follows §5.7 and does not surface
`process_restart` as a terminal queued-work failure.

**Parent lease loss cascades to live children**

Session tests prove live child sessions sharing a parent owner mark ownership
lost and stop mutation when the parent owner can no longer prove the lease.

**Subagent depth overflow semantics**

Tool-runtime tests prove the built-in `subagent` tool at the configured depth
cap returns a recoverable `isError: true` result with
`code = 'harness.subagent_depth_exceeded'` and
`details = { maxDepth, attemptedDepth }`, does not throw
`HarnessSubagentDepthExceededError`, emits no `subagent_start`, and creates no
child `SessionRecord`, thread, workspace, or pending item. Session/server tests
prove local `harness.session({ parentSessionId, ... })` and
`POST /harness/:name/sessions` with `parentSessionId` reject beyond the cap with
`HarnessSubagentDepthExceededError` / `409 harness.subagent_depth_exceeded`
before mutation, while existing previously-valid deep descendants remain
addressable after a config cap decrease.

**Concurrent cold session creation**

Storage contract tests prove two callers for the same
`(harnessName, resourceId, threadId)` get the same active `SessionRecord`; the
winner holds the initial lease or the loser follows normal lock policy.

**Multi-harness shared storage namespace**

Storage/server tests prove two registered harnesses sharing one physical adapter
can use the same caller-visible `resourceId`, `threadId`, `sessionId`,
`admissionId`, and `attachmentId` without cross-listing, cross-hydration,
cross-lease, cross-tombstone, cross-attachment, cross-message-log, cross-delete,
or cross-worker-claim effects. The same tests prove an adapter without Harness
namespace support fails init when shared by multiple registered harnesses.

**Deterministic `sessionId` mismatch for an active thread**

Resolver tests prove `{ sessionId, threadId, resourceId }` throws
`HarnessSessionConflictError` when another active session owns the pair, without
waiting on or stealing the wrong owner.

**Deterministic `sessionId` bound elsewhere**

Resolver tests prove a requested `sessionId` already bound to another
thread/resource is rejected without aliasing; same-resource collisions throw
`HarnessSessionConflictError`, cross-resource mismatches do not leak existence.

**Duplicate active-session corruption**

Resolver/storage tests prove multiple active rows for one
`(harnessName, resourceId, threadId)` fail closed with
`HarnessSessionCorruptError(reason: 'duplicate_active_session')`.

**Durable per-session workspace resume**

Hydration tests prove stored `providerId` must match the configured provider or
hydration fails with `HarnessWorkspaceProviderMismatchError`; when it matches,
`provider.resume({ state, generation, ... })` is the only recovery path for an
existing active session with a materialised durable workspace, and
`provider.create(...)` is not called as a substitute.

**Durable workspace state update hook**

Workspace tests prove a resumable provider receives `onStateChange` in
create/resume contexts, initial create state commits before the workspace is
considered materialised, resume-time state/generation rotation commits before
workspace-dependent work resumes, and rejected storage/lease/CAS writes reject
the hook without advancing `SessionRecord.workspace.state` or `generation`.

**Ephemeral or lost per-session workspace**

Recovery tests prove a materialised `resumable: false` workspace, including
factory shorthand with only a diagnostic provider identity, missing durable
state, failed permanent resume, or provider generation mismatch raises
`HarnessWorkspaceLostError` before new admissions, resumes, queue drain, or
workspace tool execution. Stored `durability: 'ephemeral'` takes this
workspace-lost branch before provider-id mismatch checks and never calls
`create` as a substitute.

**Per-resource workspace destroy guard**

Storage/API tests prove `destroyResourceWorkspace({ resourceId })` rejects while
any persisted active session for that resource exists, including sessions
evicted from memory, and cannot race concurrent session creation.

**Lazy built-in workspace tool manifest**

Tool-runtime tests prove lazy `per-session` built-in workspace tool listing and
model prompt assembly do not call provider `create(...)` / `resume(...)`;
registered wrapper names and schemas come only from stable config/static core
tool declarations and remain unchanged for the in-flight run; unsupported live
capabilities such as read-only writes, unavailable search modes, missing
sandbox/process support, dynamic `enabled: false`, workspace loss, provider
mismatch, or session lifecycle failure surface as fail-closed tool invocation
results/errors rather than changing the manifest; wrapper execution resolves
through the same session-owned resolver as §4.2/§6.2, delegates to the
corresponding current core workspace tool behavior without reimplementing
file/sandbox/search/process/LSP semantics, preserves core tool-family state such
as read tracking and write serialization, single-flights concurrent first
materialisation/resume, and resolves inherited versus fresh subagent workspaces
according to §8.

**Crash after channel inbox durable write**

Recovery claims `received` rows and admits with the original `admissionId`.

**Channel ingress retry on live-session-capacity exhaustion**

Ingress tests prove `HarnessLiveSessionLimitError` at owning-session hydration
or admission transitions the `ChannelInboxItem` to retryable `failed` with
`nextAttemptAt`, releases the claim, preserves the same `admissionId`, and later
admits when capacity frees. Exhausted `inbox.maxAttempts` marks the row `dead`
with row `lastError.code = 'live_session_limit'` (bare `HarnessRowErrorCode` per §4.5d; wire surfaces project through §13.3f.1 to `harness.live_session_limit`).

**Crash after queue drain before signal acceptance**

Hydration retries signal admission with the same `admissionId` / `admissionHash`
and either records the existing accepted `runId` / `signalId` or accepts the
signal once.

**Queue receipt `admitting` after agent acceptance but before receipt update**

Recovery retries signal admission with the same `admissionId` / `admissionHash`,
observes the existing `runId` / `signalId`, and advances the original receipt
without a second accepted signal.

**Crash after queued signal acceptance before completion**

Hydration uses the receipt's `runId` / `signalId` to observe or reconcile the
accepted run and proves no second signal is admitted for the same
`queuedItemId`.

**URL attachment durable admission**

Queue, channel ingress, wakeup, and accepted-signal tests prove URL inputs are
fetched/copied to Harness-owned storage before the durable row is written;
fetch, timeout, streamed-size, MIME, digest, scanner/content-policy, non-HTTP(S)
scheme, private/link-local/metadata target, DNS rebinding, unsafe redirect,
credential-forwarding, or raw-URL persistence failures reject before admission
with the §4.5 / §13.3 `HarnessAttachmentUnavailableError.reason` matching the
failure class and leave no replayable row that depends on the external URL.

**Attachment deletion while referenced**

Storage/API tests prove `deleteAttachment(...)` rejects with
`HarnessAttachmentInUseError` while queue, receipt, current-run,
message-history, channel inbox, wakeup, or outbox references remain, including a
race between deletion and queue/inbox admission.

**Missing or changed attachment during replay**

Recovery tests prove a missing blob, same `attachmentId` with different digest,
or corrupted bytes fails the owning message/queue/channel/wakeup operation with
`HarnessAttachmentUnavailableError` and never substitutes different content.

**Attachment cleanup after retention**

Storage tests prove unreferenced staged uploads become garbage-collection
eligible after `files.stagedAttachmentRetentionMs` with zero durable references,
while terminal receipts, message-history retention, operation tombstones, and
outbox projection keep referenced bytes alive until they release the ref.

**Duplicate admission after full result compaction**

Storage/server tests prove `resolveOperationAdmissionEvidence(...)` returns the
original `MessageAdmissionResponse` or the original `QueueAdmissionResponse` for
same-key/same-hash retries against retained `OperationAdmissionTombstone` rows,
throws `HarnessAdmissionConflictError` for same-key/different-hash retries, and
that `loadMessageResultEvidence(...)` / `loadQueueResultEvidence(...)` make
result lookup return `expired` instead of admitting new work while
tombstone-only evidence remains.

**Admission after tombstone expiry or session deletion**

Storage/server tests prove result lookup falls back to tenant-safe not-found
after tombstone expiry/deletion; an active-session admission with the same old
`admissionId` follows normal admission rules, while a closed or deleted session
does not accept new work.

**Duplicate untyped skill admission**

Session/server tests prove untyped `useSkill({ admissionId })` checks exact
duplicate signal evidence before the busy check, returns the original
`MessageAdmissionResponse` / retained terminal result evidence without admitting
a second skill run, and reports `HarnessAdmissionConflictError` when the same
key is retried with different §4.4 untyped skill hash inputs.

**Non-retry-safe sync generate and typed skill routes**

Server/SDK tests prove `message({ sync: true, output, admissionId })` and
`useSkill({ output, admissionId })` reject with `HarnessValidationError`, no
operation tombstone is created, and SDK/server automatic retry logic does not
retry those POSTs after an ambiguous transport failure. Success-path tests prove
local `Session.message({ sync: true, output })`,
`RemoteSession.message({ sync: true, output })`, and typed
`useSkill({ output })` return the projected typed value only, with no
`FullOutput` wrapper fields, no `AgentResult` envelope, and no success body when
the projection is missing or `undefined`. Failure-path tests prove
`fullOutput.error`, `getFullOutput()` rejection, structured-output validation
failure, tripwire, model failure, and approval/suspension/question/plan
interruption map to `HarnessOutputGenerationError` or another cause-specific
Harness error without pending inbox rows, signal/queue result evidence,
operation tombstones, or automatic retry eligibility.

**Schema-bearing remote APIs**

Server/SDK tests prove raw HTTP uses `WireSchemaRef`, never local `PublicSchema`
/ Zod objects; JS SDK calls serialize local schemas to JSON Schema Draft 2020-12
before POST; inline malformed, unsupported, external-ref, non-JSON, oversized,
or over-deep schemas reject with `400 harness.validation` before agent
execution; unknown or unauthorized `schemaId` refs reject before execution
without cross-scope existence leaks; skill list/read routes return
`WireHarnessSkillDescriptor` JSON schema descriptors rather than live schema
objects or SuperJSON-only schema payloads.

**Skill resolution catalog consistency**

Session/server tests prove code-registered skills override workspace-discovered
skills with the same name; workspace skills are delegated to the resolved
session workspace's configured `WorkspaceSkills` surface; and
`session.listSkills()`, `session.getSkill(...)`, untyped
`session.useSkill(...)`, typed `session.useSkill({ output })`, and any preserved
model-facing activation tool that claims session availability use the same
activation/catalog resolution chain.

**Skill cache and refresh lifecycle**

Session tests prove provisional code-only generations for lazy configured
workspaces do not populate the final cache or justify a final
`HarnessSkillNotFoundError`; `refreshSkills()` clears only the
workspace-discovery generation while preserving code-registered skills; stale
in-flight discovery results cannot repopulate the cache after refresh; and
workspace resolution, provider mismatch, resume, loss, or discovery failures
surface through the workspace error boundary instead of degrading to code-only
catalogs.

**Skill descriptor projection**

Descriptor and wire tests prove workspace `Skill` / `SkillMetadata` projects to
`HarnessSkill`, `RemoteSafeSkillDescriptor`, and `WireHarnessSkillDescriptor`
with `source: 'workspace'`, an optional path-like `filePath`, omitted
schema/default-mode fields unless equivalent metadata is supplied by the source,
and no public `references`, `scripts`, `assets`, license, compatibility, or
arbitrary frontmatter fields.

**Crash before goal judge receipt commit**

Hydration may re-run the judge only when the goal is still active and no
`lastDecision` receipt covers the latest assistant-turn cursor.

**Crash after goal `continue` receipt before continuation queue append**

Recovery reads `GoalState.lastDecision.continuation.admissionId`, appends the
continuation with the same admission key/hash, and proves the judge is not
called a second time for that source turn.

**Crash after goal continuation queue append or acceptance**

Recovery follows the `QueueAdmissionReceipt` for the continuation and proves no
second continuation is appended for the same judge receipt.

**Goal continuation FIFO ordering**

Session tests prove goal continuations have no hidden priority lane: user
`queue(...)` work admitted before the continuation append runs first, work
admitted after it runs behind, concurrent appends linearize under the session
lease, repaired continuation appends use the same ordering at the repair commit
point, and `message(...)` posted while the judge evaluates follows normal
`message(...)` admission rather than queue preemption.

**Goal pause/clear/replace while judge is in flight**

Session tests prove the stale judge result fails the
`(goal.id, goal.revision, status)` commit check, emits no `goal_judged`, and
enqueues no continuation.

**Goal `waiting` decision lifecycle**

Session tests prove a `waiting` judge decision commits `lastDecision` and
`turnsUsed`, leaves `status: 'active'` with no continuation queue append,
emits `goal_judged` followed by exactly one `goal_waiting`, does not auto-
resume on a later user `message(...)` until the next assistant turn drives a
fresh judge call, does not re-emit `goal_waiting` on hydration (clients
recover the waiting state via `getGoal()` / `GoalState.lastDecision`), and
follows ordinary `goal_paused`/`goal_cleared`/`goal_set` events when
`pauseGoal()` / `clearGoal()` / `setGoal()` run on a waiting goal. A
subagent goal in `waiting` emits `goal_waiting` on the subagent's own
stream, not on the parent. Tests also prove a `waiting` decision that
exhausts `maxTurns` follows the budget path from §4.7: the decision is
persisted, no continuation is appended, status becomes `paused`, and
subscribers see `goal_judged` followed by `goal_paused(reason:
'budget_exhausted')`, not `goal_waiting`.

**Later assistant turn completes while judge is in flight**

Session tests prove an older in-flight judge result or judge failure is
discarded when a later durable assistant turn completes before commit: no
`lastDecision` update, no `turnsUsed` increment, no goal event, no status
transition or `judge_failed` / `budget_exhausted` pause, and no continuation
append. The latest turn is then evaluated through the normal post-turn
lifecycle.

**Goal budget replacement**

Session/API tests prove a `budget_exhausted` pause does not enqueue a
continuation, `resumeGoal()` does not mutate `maxTurns`, and continuing with a
higher cap uses `setGoal(...)` replacement semantics: the prior goal is cleared,
the new `GoalState` commits with `turnsUsed` reset, and subscribers observe the
normal `goal_cleared` then `goal_set` sequence.

**Goal judge auto-answer races with human or channel question response**

Session/server tests prove judge auto-answer uses a deterministic `responseId`,
writes a normal `InboxResponseReceipt` with `goalJudge` metadata only if it wins
the owning-session lease, and obeys first-response-wins: human/channel responses
that commit first consume the pending question and the judge answer is
discarded; judge answers that commit first make later human/channel responses
observe the normal stale/consumed/conflict result.

**Goal state changes while judge question auto-answer is in flight**

Session tests prove pause, clear, replace, session closing, closed-session
state, or a missing/changed pending question before the receipt commit prevents
the judge from writing an `InboxResponseReceipt`, emits no extra goal event, and
leaves any still-present pending question answerable by normal inbox callers.

**Crash after accepted goal judge question response before resume**

Recovery tests prove `InboxResponseReceipt(status: 'accepted', goalJudge: ...)`
retries the run resume with the same deterministic `responseId` /
`resumeAttemptId`, does not ask the judge again for the consumed pending item,
and does not apply a second resume after the receipt becomes `applied`.

**Goal judge auto-answer scope and shape validation**

Session tests prove a parent/root goal never answers descendant subagent inbox
items; a subagent-owned prompt is auto-answerable only by a goal active on that
same owning subagent session. Invalid judge answer shape or option selection
pauses the goal with `reason: 'judge_failed'`, writes no `InboxResponseReceipt`,
and leaves the pending question available for human response.

**Crash after rendered prompt before action callback**

Projection/restart tests prove the old rendered button verifies against the
retained `ChannelActionToken`, answers the same `actionTokenId`, and does not
require a live in-memory handle.

**Crash after pending prompt before outbox enqueue**

Projection tests recreate the missing prompt by create-or-loading the same
`ChannelActionToken`, producing the same token transport rendering, payload
hash, operation identity, and outbox idempotency key. Concurrent projection
creates one token row, not multiple token groups.

**Crash after action receipt write**

Recovery applies the same `responseId` and observes any existing
`InboxResponseReceipt`.

**Crash after inbox response receipt written but HTTP reply lost**

SDK retries with the same auto-generated `responseId` and receives the first
applied result or current accepted status. Server returns stored
`InboxResponseResult` from the retained `InboxResponseReceipt` without applying
a second resume.

**Duplicate resume attempt**

Agent-boundary tests prove a duplicate `resumeAttemptId` with the same
`responseHash` returns the original in-flight, applied, or failed result and
does not consume or resume the workflow snapshot a second time. Same
`resumeAttemptId` with a different response hash fails as
`HarnessInboxResponseConflictError` before the resume boundary is called.

**Tool-suspension deferred resume**

Session/server/SDK tests prove `respondToToolSuspension(...)` commits
`InboxResponseReceipt(status: 'accepted')` and throws or rehydrates
`HarnessRecoveryDeferredError` / `harness.recovery_deferred` when the workflow
snapshot is not yet observable; exact retry with the same `responseId` resumes
once the snapshot is visible, advances the receipt to `applied`, and does not
resume twice.

**Crash after resume applied before receipt marked applied**

Recovery retries the same `resumeAttemptId`; the §4.2 Required Agent Resume
Boundary reports the prior applied result or terminal status, and the session
marks the `InboxResponseReceipt` `applied` or terminal without invoking a second
resume.

**Unsupported idempotent resume kind**

Session and channel tests prove a pending kind whose resume path does not
support `resumeAttemptId = responseId` is rejected or disabled before clearing
the pending field or writing `InboxResponseReceipt(status: 'accepted')`. Legacy
accepted receipts for unsupported kinds terminalize with an unsupported-resume
error instead of calling `resumeStream(...)` / `resumeGenerate(...)` without
idempotency.

**Corrupted multiple pending items for one run**

Hydration tests prove that when two or more canonical pending fields reference
the same non-terminal `currentRun.runId`, all matching pending fields are
cleared, matching accepted inbox/action receipts terminalize with
`pending_state_corrupt`, the run is marked `interrupted`, an `error` event is
emitted, and the queue continues. Server/SDK tests prove snapshots,
`PendingInboxItem` projection, `/subagent-inbox`, channel prompt projection,
channel action callbacks, and local `respondTo*` calls fail closed or observe
the repaired state rather than choosing one pending item.

**Channel action retry on live-session-capacity exhaustion**

Action tests prove `HarnessLiveSessionLimitError` at owning-session entry
transitions the `ChannelActionReceipt` to retryable `failed` with
`nextAttemptAt`, releases the claim, preserves `responseId = receipt.id`, and
later applies when capacity frees. Exhausted `actions.maxAttempts` marks the
receipt `dead` with row `lastError.code = 'live_session_limit'` (bare `HarnessRowErrorCode` per §4.5d; wire projection `harness.live_session_limit`).

**Crash after schedule claim before publish**

Wakeup tests prove the `HarnessWakeupItem` remains due/claimable and queues with
the same `admissionId`.

**Published-not-consumed wakeup**

Worker tests prove a wakeup not reflected in `QueuedItem` remains claimable
despite pubsub loss.

**Scheduled/proactive channel wakeup with stale or missing binding**

Wakeup tests prove binding-backed channel work validates `bindingId` and
`bindingGeneration` before queue admission, copies target identifiers from the
active `ChannelBinding`, and never fabricates `externalThreadId`. Missing,
replaced, closed, deleted, or undeliverable bindings follow the wakeup policy:
explicit non-channel queueing without outbox projection, retry/defer, skip, or
terminal dead-letter.

**Crash after recoverable assistant output before outbox enqueue**

Projection tests recreate the missing row with the same deterministic key only
when the assistant output or file reference is recoverable from committed
message/run/thread/tool state, workspace state, or application datastore state.
Tests cover assistant-message part keys, durable tool-result summary keys,
provider-visible status keys, same-key/different-payload conflicts, and
same-binding source-order preservation across a recovery projection batch.

**Outbox projection retry on live-session-capacity exhaustion**

Projection tests prove `projectMissingOutboxItems(sessionId)` skips a session
that cannot hydrate because of `HarnessLiveSessionLimitError`, does not create
partial rows or mark existing outbox rows `failed` / `dead`, and retries
projection on a later outbox poll/backoff.

**Crash after provider acknowledgement before sent mark**

Adapter-operation tests cover native idempotency, client message ID,
lookup/reconcile, and documented at-least-once duplicate risk for mixed
operation kinds such as message create, message edit, reaction add/remove, file
upload, and custom operations. Tests also prove same-key/different-operation
enqueue conflicts and rows whose current adapter no longer supports the stored
operation/mode retry with `delivery_operation_unavailable` before dead-letter.

**Stale action token**

Action tests reject consumed, expired, revoked, wrong-run, wrong-generation, and
reused-`itemId` tokens when no compatible `ChannelActionReceipt` exists. Expired
or revoked tokens with a matching existing receipt return the stored/current
first-response status, while same-token/different-response callbacks still
conflict. Tests also prove token revocation racing with first-use receipt
creation is ordered by the durable token/receipt writes: revocation before
receipt creation blocks first use, while revocation after compatible receipt
creation does not hide duplicate replay.

**Stale channel prompt resolution**

Projection/action tests prove trusted globally terminal stale-card cases enqueue
at most one redacted `inbox-resolution` / `message-edit` / `status` outbox item
only when a prior sent prompt row proves the exact durable provider message
handle. They prove the stale response is never applied, resume is not called,
replacement bindings are not targeted, actor-specific or malformed/unknown-token
failures do not mutate a shared card, and diagnostics remain redacted when no
durable target handle exists.

**Exact duplicate create-or-load with `initialClaim` on terminal or completed channel/wakeup rows**

Storage contract tests prove inbox `accepted` / `queued` / `dead`, action
`applied` / `conflict` / `dead`, and wakeup `queued` / `skipped` / `dead` return
`duplicate: true`, `claimed: false`, and the stored status, result, and conflict
reason when present. An `accepted` action receipt duplicate returns
`claimed: false` without re-entering response processing. Tests also prove
retryable duplicates follow the same status, due-time, and expired-claim
predicate as scan workers.

**Channel action audience policy**

Action tests prove `verifyAction` supplies the provider-verified actor when the
token's deployment-owned audience policy requires it; missing required actor
identity or policy mismatch fails as `actor_not_allowed` before first-use
receipt creation, does not consume the first-response slot, and does not mutate
a shared stale card. Accepted receipts snapshot the winning `verifiedActor`,
remain replayable after expiry/revocation/policy changes, and never let a later
callback overwrite that actor.

**Missing workflow snapshot**

Hydration tests drop the pending item, emit an error, and continue the queue.

**Concurrent signal messages in one run**

Event/SDK tests prove each admitted `signalId` receives exactly one matching
operation-scoped `message_completed` or `message_failed`, and that `agent_end`,
lifecycle events, or unrelated signal completions do not settle the wrong
promise.

**Local harness control-plane subscription**

Event tests prove `harness.subscribe(...)` receives harness-scoped events plus
live fan-out copies of session-scoped events from every live Session owned by
that Harness instance, including a second root session and a child/subagent
session; session-attributed events carry the correct `sessionId`; parent-adapted
`subagent_*` events and raw child-session events can coexist without automatic
dedupe; per-session FIFO is preserved, no global cross-session ordering or
backfill is promised, and listener failures follow the §10.4 isolation rule.

**Lifecycle event terminality**

Event tests prove `session_closing` is emitted only after `closingAt` commits
and does not by itself settle message/queue operations or mark the session
closed; `session_closed` is emitted only after a durable close writes
`closedAt`, while eviction emits non-terminal `session_evicted` and process
shutdown emits at most harness-scoped `harness_shutdown`. Eviction/shutdown do
not settle operations, mark the session closed, or prevent later hydration.

**Zero-downtime drain protocol**

Server/worker/SDK tests prove the §13.6 drain sequence: new externally reachable
Harness durable ingress (channel inbound, channel action callbacks, session
signal/queue/inbox writes, attachment uploads, wakeup-producing
schedule/proactive routes) is refused with `503 harness.worker_unavailable`
`reason: 'server_draining'` or a layer-7 connection-stop before
`mastra.shutdown()`; admitted in-flight turns, SSE consumers, and route handlers
settle within the bounded window or release the session lease cleanly without
emitting `session_closed` for still-active records; channel inbox/action/outbox
workers, `HarnessWakeupItem` processors, and reconstructable background-task
workers stop claiming new rows for their ownership scopes, renew only the claims
for work they are actively finishing, and either commit terminal updates under
the existing claim or let the claim TTL expire; undelivered
channel/wakeup/reconstructable-task rows remain in storage for the next
instance; raw closure-backed background-task work without an owning durable
Harness row is not part of the drain contract and may be cancelled at shutdown.

**Close/interruption with unresolved accepted signals**

Session/event tests prove close, abort, process-restart interruption, and
runtime-drift fail-closed paths record `message_failed` / `queue_failed` for
every unresolved accepted operation before any corresponding promise settles.

**Close with pending queued items**

Session/event tests prove close records `queue_failed` for queued items that
have not yet crossed the signal boundary, so `queue(...)` promises and
duplicate-result lookups do not hang.

**Closing phase admission rejection**

Session/server tests prove that after `closingAt` commits and before `closedAt`,
`message`, `queue`, `useSkill`, inbox responses, resume calls, descendant
creation, `setState`, mode/model/goal/permission/thread-setting mutations,
attachment writes, channel ingress admission, wakeup admission, and outbox
projection for that session fail or skip with `HarnessSessionClosingError` /
`harness.session_closing`, while read routes, state snapshots, retained result
lookups, and event streams remain available.

**Close timeout forced terminalization**

Session/event tests prove a run or tool that ignores
`HarnessAbortedError.reason = 'session_closed'` cannot keep close pending past
`closeDeadlineAt`: unresolved accepted signals and pending queued items get
`message_failed` / `queue_failed`, pending prompt fields are cleared, active
bindings close with `closedReason: 'session_closed'`, terminal result/tombstone
evidence commits before the corresponding `closedAt`, `session_closed` is
emitted only after `closedAt`, and late tool writes cannot change terminal
failed results or session state.

**Close crash/retry idempotency**

Recovery tests prove a crash or lease loss after `closingAt` but before
`closedAt` leaves a visible Closing record that reserves the active key, rejects
new work, and is completed by a later `closeSession(...)` owner using the stored
`closeDeadlineAt` without resetting the timeout. Retrying DELETE after an HTTP
timeout resumes the same marker and does not start a second close; if `closedAt`
already committed for a tenant-verified retained session, the retry is a
successful no-op close response. Server/SDK tests prove ambiguous DELETE
transport failures recover through retrying DELETE and/or reading
`SessionSnapshot.summary.lifecycle` plus `closingAt` / `closeDeadlineAt` /
`closedAt`, without a separate close-status route; deleted, staged-deleted, or
cross-resource sessions remain tenant-safe not-found. A terminalization failure
after `closingAt` does not release the parent/root lease voluntarily and does
not roll the row back to Active; a later owner skips already-closed descendants
and completes remaining `closedAt` writes bottom-up.

**SSE replay gap during pending operation**

Server/SDK tests prove unresolved `signalId` / `queuedItemId` promises recover
through result lookup routes after `412`, including completed, failed, expired,
and still-pending responses.

**Embedded `AgentResult` identity consistency**

Event/storage/SDK tests prove that when `AgentResult` appears in
`message_completed`, `queue_completed`, `QueueAdmissionReceipt.result`,
signal-result status, or wire result lookup responses, its `runId`, `signalId`,
`queuedItemId`, and `admissionId` fields exactly match the enclosing carrier
when those fields are present. Mismatches are treated as corrupt serialization;
nested result identity never overrides carrier routing, lookup, or settlement
identity.

**Session inspection reads**

Session/server/SDK tests prove local and remote `isBusy()`, `waitForIdle(...)`,
`getQueueDepth()`, `getCurrentRunId()`, `getCurrentTraceId()`, and
`getTokenUsage()` read session-owned live state plus reconciled
`SessionRecord.currentRun`, `SessionRecord.pendingQueue`, and
`SessionRecord.tokenUsage` projections rather than legacy Harness process-local
fields. Coverage includes hydration/restart, evicted-session reads rebuilt from
storage, no-live-run `null` run/trace cases, pending/resuming current runs,
non-empty queued-but-idle FIFO depth, queued items accepted but not yet
completed, pending approval/suspension/question/plan idle blocking, timeout
rejection from `waitForIdle(...)` without operation settlement evidence,
token-usage reads from the live owner before debounced flush, token-usage
hydration from `SessionRecord.tokenUsage`, and legacy
`thread.metadata.tokenUsage` not overriding an existing active `SessionRecord`.

**Session list and snapshot read models**

Server/SDK tests prove `GET /sessions` returns auth-scoped
`WireListPage<SessionListItem>` with bounded navigation fields and no raw
message bodies, raw request context, bearer credentials, action tokens, or
unscoped channel identifiers. Tests prove `GET /sessions/:sessionId` returns an
`ETag` plus `SessionSnapshot` with lifecycle, state, current-run operation refs,
queue item IDs/depth, session-owned pending inbox projections, display snapshot,
goal state, channel binding summaries, token usage, and a bounded message window
or message cursor. After `412`, SDK recovery refetches the snapshot, settles
unresolved `signalId` / `queuedItemId` through result lookup routes, follows the
thread message cursor for persisted history, and does not synthesize missed
SSE/tool/channel events or require a generic durable timeline/work ledger.
Closed sessions return terminal snapshots while retained operation evidence
exists; evicted sessions return snapshots rebuilt from `SessionRecord` storage.

**Pagination and cursor contracts**

Storage/server/SDK tests prove cursor-bearing reads reject malformed, expired,
wrong-scope, wrong-filter, non-positive, fractional, and over-maximum `limit` /
`cursor` inputs before scanning; return stable `nextCursor` values bound to
route, resource/session/thread scope, filters, and ordering; preserve message
ordering by `(createdAt, id)`; page sessions by
`(lastActivityAt DESC, sessionId DESC)`; page threads by
`(updatedAt DESC, id DESC)`; page subagent inbox rows by
`(requestedAt ASC, owningSessionId ASC, itemId ASC)`; and treat cursors as
navigation tokens rather than principal read-state or SSE replay state. Activity
timeline tests prove `(occurredAt, sessionId, entryId)` forward progress,
`includeDescendants` cursor-scope mismatches rejecting as wrong-filter
validation errors, no duplicate `entryId` values inside one response's session
scope, source-ref coalescing for the same display occurrence, late-arriving
entries that sort at or before the cursor being skipped rather than leaked or
used for settlement, skip-without-leak behavior when source rows, tombstones, or
deleted descendants expire between pages, and that a
`SessionRecord.version`-only validator is never used to return
`304 Not Modified` or enforce `If-Match` on `/activity`. If an implementation
advertises activity `ETag` support, tests prove the validator covers every
included source authority for the exact projection shape.

**Multi-session controller recovery**

Server/SDK/controller tests prove a browser/controller reload after Harness
restart, session eviction, auth-token refresh, or SSE `412` rebuilds from
`GET /sessions` plus per-session `SessionSnapshot` reads for the rendered or
supervised sessions; settles unresolved message / untyped `useSkill` operations
by `signalId` and queue operations by `queuedItemId`; refreshes
`/subagent-inbox` for rendered or supervised parent/root sessions; attaches only
per-session `/events` streams for rendered or supervised sessions; renders
merely listed sessions from read models; inserts local gap markers for affected
timeline/activity views; and does not synthesize missed events, require durable
SSE history, or expose remote cross-session fanout.

**Durable work summary projection**

Server/SDK tests prove `SessionListItem.durableWork` and
`SessionSnapshot.durableWork` are bounded, JSON-safe, session-owned projections
over existing source-specific rows. Tests cover non-terminal queue receipts,
wakeups claimed before queue admission, accepted inbox responses, channel
inbox/action/outbox retry/dead states, goal continuations whose queue append is
being repaired, accepted-signal tombstone `expired`, closed-session retained
terminal evidence, deleted-session hiding, and exclusion of unlinked or
closure-backed background tasks. Tests prove handoffs such as channel inbox ->
message/queue, wakeup -> queue, goal decision -> continuation queue receipt,
action receipt -> inbox response, receipt -> compact tombstone, and `currentRun`
-> source-authoritative proof never produce two active or recoverable summaries
for one logical operation chain. Tests also prove raw payloads, request context,
provider receipts, token material, hashes, claim IDs, and unredacted error
messages are absent, and that a raw background-task row with
`status: 'completed'` alone never marks Harness-visible or provider-visible work
completed.

**Background task row classification**

Storage/server tests prove `BackgroundTaskDiagnosticRow` rows are never returned
by `claimBackgroundTasks(...)`, even when they carry `ownerRef`;
`BackgroundTaskReconstructableRow` rows are the only claimable task rows; and
diagnostic rows enter `DurableWorkSummary` only when their `ownerRef` resolves
to an authoritative Harness durable row that proves the namespace, resource, and
session.

**Display snapshot JSON and reconnect**

Storage/server/SDK tests prove `getDisplayState()`,
`subscribeDisplayState(...)`, `SessionRecord.displayState`,
`GET /sessions/:sessionId`, and `412` recovery use
`HarnessDisplayStateSnapshotV1`: no `Map`, `Set`, `Date`, functions, or class
instances; deterministic ordering for keyed arrays; malformed or unsupported
snapshot versions are ignored and rebuilt through the §5.1 field-to-source
projection rules; stale pending, active run/tool, subagent, file, and task
display fields are cleared or recomputed from authoritative session/message
records; and no `display_state_changed` event is emitted over SSE or used for
durable replay.

**Tool custom-event API boundary**

Tool-runtime/event tests prove `emitCustomEvent(input)` is the only
author-facing custom-event API: exact built-in and reserved names reject with
`HarnessValidationError`; omitted payload stays omitted while non-JSON payloads
and extra top-level input fields reject; caller-supplied identity or attribution
names inside `payload` remain nested payload data and do not override the
emitted event envelope; parent-surfaced subagent custom events carry §10.6
attribution from trusted context; and legacy raw `emitEvent`, built-in/internal
emitters, and `writer.custom()` / `data-*` chunks are not exposed as the Harness
custom-event API unless explicitly adapted through the v1 event adapter.

**Evented workflow request context**

Coverage proves a `requestContext` supplied for an EventedAgent run (including a
trusted `channel`-shaped value or equivalent sentinel) flows through
`EventedAgent.executeWorkflow(...)` into `Workflow.startAsync(...)`, is
snapshotted on workflow start, and is published on the `workflow.start` event.
The wrapper loads the run's persisted context from the durable-agent run-state
authority rather than from fresh caller input, mirroring the base
`DurableAgent.executeWorkflow(...)` path used for `Workflow.start(...)`.
Reserved top-level request-context slots cannot be spoofed by direct callers;
only the persisted context from the admitting boundary survives the wrapper hop.

**Reserved request-context key rejection**

Server and in-process admission tests prove `message`, `queue`, `useSkill`, and
inbox response entry points reject caller request context containing any
top-level key other than `app` (`channel`, `harness`, `MastraMemory`, `browser`,
`user`, `userPermissions`, `userRoles`, `mastra__*`, `__mastra*`, or unknown
future infrastructure slots) with `HarnessValidationError` /
`400 harness.validation` before session admission, durable writes, or
request-context hashing.

**Request-context assembly precedence**

Session/tool-runtime tests prove the §4.4 source order: fresh caller `app`
validates as canonical JSON before admission; trusted `channel` is populated
only by Harness-owned integration paths; queued, recovered, replayed, and
resumed work rebuilds from persisted `PersistedRequestContextInput` without
merging fresh caller `app`; runtime-only slots rebuild last; identity and
subagent linkage cannot be overwritten by request-context input; `app` and
`channel` remain top-level siblings; and runtime-only slots are absent from
persisted request-context rows, stable hashes, public read models, activity
projections, wire responses, and client-facing diagnostics. Tests also prove
channel-origin recovery revalidates binding-backed channel context through §14.3
before trusting it.

**Harness runtime slot isolation**

Session/tool-runtime and workflow serialization tests prove caller-provided
`RequestContext` objects are not mutated with a top-level `harness` key; the
tool-visible `harness` slot is rebuilt fresh for each tool execution on a
detached context or overlay; subagent tool calls do not inherit parent-owned
callable fields through a shallow copied slot; and persisted workflow, queue,
current-run, wakeup, inbox/action, stable-hash, and diagnostic request-context
DTOs cannot contain a partially serialized `harness` object after generic JSON
serialization.

**Harness tool context projection**

Tool/context tests prove every Harness-managed tool family receives the
per-execution `requestContext` `harness` slot while `context.mastra` is absent
or is the named constrained facade; the facade cannot reach raw storage,
deprecated primitive storage, agent or workflow registries, provider/channel
clients, mutable framework registries, or other session-bypassing framework
capabilities. Tests also prove internal tool families that previously received
the generic `context.mastra` surface operate through the constrained facade or
through `HarnessRequestContext` surfaces.

**Runtime dependency drift**

Scope: `HarnessRunOperationalState` identities and
`runtimeCompatibilityGeneration` plus current config.

Hydration tests prove missing modes, missing agents, changed mode-to-agent
bindings for a non-terminal `currentRun`, missing models/tools/MCP
bindings/workspace providers, and a mismatched `runtimeCompatibilityGeneration`
fail closed with `runtime_dependency_drifted` and leave source-specific work
retryable or dead-lettered. Hydration also proves backward compatibility: legacy
runs without a persisted generation fall back to ID-only validation.

**MCP runtime status boundary**

Local/server diagnostic tests prove any exposed MCP status is read-only and
clearly diagnostic: public session read models do not include per-binding MCP
status; diagnostic surfaces do not create or mutate `SessionRecord`, queue,
inbox, wakeup, channel, outbox, operation tombstone, or callback/effect receipt
rows; diagnostics do not settle message/queue operations; they redact/bound
stderr and config-path details according to the exposing surface's policy; and
MCP progress, elicitation, resource subscription, and HTTP transport session IDs
are not treated as Harness recovery keys.

**Non-rehydratable tool surface**

Hydration tests prove a `currentRun` with `nonRehydratableToolSurface: true`
drops `pendingApproval` / `pendingSuspension` / `pendingQuestion` /
`pendingPlan` for the run, advances any `accepted` `InboxResponseReceipt` and
channel-originated `ChannelActionReceipt` to terminal failure with row
`error.code = 'tool_surface_unrehydratable'` (bare `HarnessRowErrorCode`,
§4.5d), marks the run `interrupted` with the same bare row code on
`HarnessRunOperationalState.error.code`, emits the matching `error`
`TurnEvent` projected through §13.3f.1 with
`error.code = 'harness.session_corrupt'` and
`error.details.reason = 'tool_surface_unrehydratable'`, and does not invoke
`agent.resumeStream(...)`, LLM execution, processor execution, or tool-call
execution for that run. Coverage spans `message`, `message({ stream: true })`,
`message({ sync: true, output })`, `useSkill`, and compatibility paths for
per-run executable toolsets/client tools after registry loss. Tests prove
metadata-only tool snapshots and same-named registered fallback tools are not
treated as recovery evidence, but typed sync output and typed skill calls must
still prove that no signal/queue result evidence, operation tombstone, or
automatic retry-safe lookup is created in v1.

**Subagent inbox recovery after SSE replay gap**

Server tests prove `GET /sessions/:sessionId/subagent-inbox` lists descendant
pending items and that writes still target the owning subagent session.

**Parent close cascade to active descendants**

Lifecycle tests prove `closeSession(parent)` walks `listChildSessions(...)`
recursively under the parent (depth > 1, paged through `nextCursor`, ordered
`(createdAt ASC, sessionId ASC)`), installs `closingAt` / `closeDeadlineAt`
top-down across every active descendant including persisted-only rows, keeps
rows whose `closedAt` commits mid-walk visible to `includeClosed: true` pages,
applies terminal close steps bottom-up, asserts
`descendant.harnessName === parent.harnessName` and
`descendant.resourceId === parent.resourceId` and fails closed on mismatch,
writes each session's `closedAt` before local eviction, writes the close
target's `closedAt` last, releases the parent/root lease authority only after
the close target's `closedAt` commit or after fencing, and is idempotent across
re-runs after partial failure. The one `closeDeadlineAt` covers the whole
subtree; eviction and shutdown release the parent lease without running the
cascade.

**Non-force delete blocks dependent work**

Delete tests prove `deleteSession({ force: false })` rejects with
`HarnessSessionDeleteBlockedError` while the target is active, any descendant is
active, queue/inbox receipts are non-terminal, pending items remain, active
bindings remain, retryable or claimed channel/wakeup/outbox rows reference the
session subtree, attachment refs remain guarded, or per-session workspace
cleanup cannot be proven complete.

**Force delete cascades terminal rows**

Delete tests prove the §5.5 `deleteSession({ force: true })` lifecycle fences
the owner, walks active and closed descendants bottom-up, marks dependent
`ChannelInboxItem`, `ChannelActionReceipt`, `ChannelOutboxItem`, and
`HarnessWakeupItem` rows terminal `dead` with `session_deleted`, revokes
retained `ChannelActionToken` rows for the deleted session subtree with
`session_deleted`, invalidates or waits out any active worker claim before
completion, closes bindings with `closedReason: 'session_deleted'`, and skips
already-terminal rows without re-emitting close settlement.

**Typed `error` event payload across recovery failure modes**

Session/SDK tests prove that every `error` `TurnEvent` and every §13.3f
error response carries `error.code` from `HarnessErrorResponse['code']`
(always `harness.*`-prefixed) and never a bare `HarnessRowErrorCode`
literal. Tests cover each recovery branch end-to-end:
`harness.session_corrupt` with `details.reason: 'pending_state_corrupt'`
and `details.reason: 'tool_surface_unrehydratable'`;
`harness.runtime_drift` with `details.missingRefs` populated for at least
one of `mode | agent | model | tool | mcp_binding | workspace_provider
| executor | completion_policy | sandbox_policy | channel`;
`harness.session_deleted` with each documented `details.cause` value
(`cascade | force | tenant_delete | thread_delete`);
`harness.channel_binding_closed` with `details.reason: 'platform_unlinked'`
and `details.reason: 'operator_closed'`; and
`harness.channel_delivery_unavailable` with the corresponding outbox row's
`HarnessRowErrorCode` `'delivery_operation_unavailable'`. The matching
storage rows continue to carry bare `HarnessRowErrorCode` literals in
their `lastError.code` / row `error.code` / `closedReason` /
`revokedReason` fields per §13.3f.1.

**Wire projection enforces §13.3f.1**

Server/SDK tests prove that no §13.x route, SSE `data:` payload, or
`error` `TurnEvent` ever surfaces a bare `HarnessRowErrorCode` literal
as a top-level `error.code`. DTOs that carry `lastError` (e.g.
`SessionListItem`, `DurableWorkSummary`, `HarnessRunOperationalState`)
rewrite their bare row codes through the §13.3f.1 projection table
before serialization. The legacy `HarnessEvent` projector emits unknown
legacy strings as `harness.internal` with the legacy string preserved
on `details.legacyCode` rather than passing the bare value through.

**`AgentChunkType` to `HarnessEvent` selected projection**

Live-projection tests (not durable replay; §10.5 and §15.3 defer durable
chunk replay) prove that the §10.0 source-stream adapter selects only
the variants the §10 union owns: `text-delta` lands as
`TurnEvent.text_delta`; final `tool-call` lands as `ToolEvent.tool_start`
(streaming-prelude chunks `tool-call-input-streaming-start` /
`tool-call-delta` / `tool-call-input-streaming-end` are absorbed and do
not produce per-chunk events); `tool-result` and `tool-error` land as
`ToolEvent.tool_end` with `isError` set from the chunk;
`tool-call-approval` lands as `SuspensionEvent.tool_approval_required`
**only after** the matching `PendingApproval` row commits under the
session lease; `tool-call-suspended` lands as
`SuspensionEvent.tool_suspension_required` **only after** the matching
`PendingToolSuspension` row commits under the session lease;
`finish` lands as `TurnEvent.agent_end`; `error` lands as
`TurnEvent.error` carrying a `HarnessEventError` envelope per §13.3f.
Tests assert that unmapped chunk families (`reasoning-*`, `source`,
`file`, `response-metadata`, `redacted-reasoning`, `text-start` /
`text-end`, `start`, `step-*`, `tool-output`, `tripwire`, `watch`,
`is-task-complete`, `object*`, `raw`, `abort`) do not appear on the
public session SSE surface, and that `background-task-*` chunks
project through §4.8c / §5.1b.2 background-task routes rather than
`HarnessEvent`. Tests also prove the `source: 'parent' | 'subagent'`
discriminator on `SuspensionEvent` is preserved end-to-end when the
underlying chunk originates from a subagent run (§10.6).

**Staged delete crash recovery**

Storage/recovery tests prove that after an internal delete marker commits,
public hydration/list/result/duplicate routes treat the session as deleted or
tenant-hidden, workers do not admit new work for the session, retrying delete or
running the delete reconciler finishes tombstone, attachment, workspace,
descendant, and source-row cleanup idempotently, and the marker is removed or
garbage-collected without changing public deleted-session behavior.

**Deleted-session duplicate and worker behavior**

Channel/wakeup tests prove terminal rows retained after delete are not claimed
by `initialClaim` or scan workers, exact duplicate provider/action lookups
return stored terminal status/result/conflict, workers never loop on
`HarnessSessionNotFoundError` for a deleted owning session, and pre-delete
`received` / `admitted` inbox rows that had not yet persisted `sessionId` are
dead-lettered with `session_deleted` instead of being retargeted to a
replacement binding.

**Force delete with in-flight outbox claim**

Outbox tests prove a dispatcher whose row was fenced by delete cannot later mark
the row sent/dead with the stale claim; provider-visible side effects already
started before fencing follow the row's stored operation identity and
`deliverySemantics`.

**Force delete removes admission tombstones and attachments**

Storage/server tests prove tombstones are hidden or removed before the
`SessionRecord` disappears, deleted-session lookup returns tenant-safe not-found
rather than `expired`, and abandoned attachment refs/bytes for the deleted
subtree are removed after dependent rows are terminalized or deleted.

**Force delete per-session workspace cleanup**

Workspace tests prove force delete destroys a reconstructable materialized
`per-session` workspace when the provider lifecycle supports it, and treats
unreconstructable cleanup as abandoned operator cleanup rather than retryable
Harness work.

**Shared message-log adapter consistency**

Storage/session/memory tests prove `Session.message(...)`, drained `queue(...)`,
channel ingress, wakeup recovery, and accepted assistant outputs commit to the
same durable thread/message rows read by `Session.listMessages(...)`,
`MessageHistory`, `SemanticRecall`, thread-scoped `WorkingMemory`,
observational-memory message scans, display reconstruction, and outbox
projection. Tests cover restart, resource-scoped reads, deterministic ordering,
duplicate message ID conflicts, and the absence of a second Harness-only message
log.

**Thread-delete cascade lifecycle**

Lifecycle/thread tests prove `harness.threads.delete({ threadId, resourceId })`
and `DELETE /harness/:name/threads/:threadId` resolve the thread inside
`(harnessName, resourceId)`, run the §5.5 close/force-delete lifecycle for every
active and retained closed session bound to the thread, reach descendant
sessions through `listChildSessions(...)` even when their `threadId` differs,
terminalize dependent queue, inbox/action/outbox, wakeup, tombstone, attachment,
binding, and workspace rows before session removal, clear only exact
thread-scoped OM/history for the deleted `(harnessName, resourceId, threadId)`,
preserve resource-scoped OM, and only then call raw memory/gateway physical
thread/message cleanup. Tests also prove a thread with no sessions still removes
the verified thread, messages, and scoped OM, while legacy/current `/memory/*`,
`Memory.deleteThread(...)`, and raw `MemoryStorage.deleteThread(...)` are not
accepted as the public v1 lifecycle unless wrapped by that cascade.

**Observational memory snapshot and cleanup**

Storage/server/SDK tests prove raw OM rows created through the Harness adapter
carry the bound `harnessName` or an equivalent key prefix; adapters that cannot
provide that namespace do not expose Harness OM snapshots in shared
multi-harness configurations. `session.om.getRecord()` and
`GET /sessions/:sessionId/om` return only the JSON-safe
`ObservationalMemorySnapshot` for the tenant-verified session/resource and
configured OM scope; raw OM rows, raw config blobs, metadata, buffered
chunks/reflections, history records, provider clients, live model objects,
functions, locks, and processor internals are absent. Tests prove OM model
switches commit through the session lease/ETag path and reject stale, closing,
closed, or unauthorized calls before events. Lifecycle tests prove
`deleteSession` leaves thread-scoped OM available for a later session on the
same thread, while `threads.delete` clears all thread-scoped OM rows and history
for the deleted `(harnessName, resourceId, threadId)` without affecting another
Harness, another resource, or resource-scoped OM.

**Child request on a non-owning Harness instance**

Routing tests prove an inbox response or other write to `child.sessionId` (and a
grandchild's `sessionId`) on instance B while instance A holds the parent/root
lease verifies the addressed session inside the authenticated scope before
walking `parentSessionId`, then applies the parent/root's `lockMode`: `'fail'`
returns `HarnessSessionLockedError` with the parent/root `currentOwnerId`,
`'wait'` blocks ≤ `lockWaitMs`, `'steal'` fences A and may leave a partial
cascade for the new owner to repair by re-issuing close. A child write that
observes a parent already closed by cascade returns `HarnessSessionClosedError`
rather than locked.

**Cascade close vs in-flight accepted-signal terminal settlement**

Concurrency tests prove that when an active descendant has an accepted signal
mid-flight at close time, terminal settlement and `closedAt` linearise under the
parent owner: no double-terminal emission, no lost terminal, and
`message_failed` / `queue_failed` is recorded only for unresolved operations.

**Background task registry resolution**

Task recovery tests prove a reconstructable row is claimed before executor
start; `executorRef.id` and `completionPolicyRef.id` resolve only through §9
`backgroundTasks` registries; missing entries, wrong `kind`, executor/completion
generation mismatch, invalid completion metadata, unavailable tool surfaces, and
`runtimeCompatibilityGeneration` drift fail closed with
`runtime_dependency_drifted`; no raw task row is treated as successful delivery;
and diagnostic rows with `ownerRef` remain behind their owning source row
instead of being claimed.

**Background task claim fencing**

Storage and worker tests prove concurrent dispatch/recovery claims produce
exactly one current owner for due `pending`, retryable `failed`, or
stale-claimed `running` rows; failed claims no-op before executor start; renewal
failure stops before session mutation, completion hooks, provider calls,
retries, or terminal writes; completion/failure/cancel transitions reject stale
`claimId`; recovery takes over only after storage-time `claimExpiresAt`; and
cleanup skips nonterminal claimed rows.

**Background task completion policy durability**

Worker tests prove executor success does not mark a reconstructable task
`completed` until the registered completion policy has committed durable
Harness/session state or enqueued outbox-producing work under the current claim;
completion-policy failure, removal, generation drift, or metadata
incompatibility transitions the row to retryable `failed` or `dead` without
provider-visible side effects.

**Local interval validation**

Unit tests reject duplicate IDs and invalid intervals, verify `immediate`
defaults to `false`, skip overlapping ticks, and prove unsubscribe,
`stopIntervals()`, and shutdown await in-flight handler plus shutdown hook.

**Multi-harness shared provider routes**

Registry tests prove one callback target maps to exactly one
harness/channel/provider owner and rejects ambiguous overlap with legacy
`AgentChannels`.

**Controlled channel platform bypass fences**

Server/channel tests prove that when a channel target is harness-bound,
overlapping legacy `AgentChannels` webhook routes, action handlers, live stream
handlers, and directly injected channel reaction/post tools for that target are
rejected at init or rewritten/limited to enqueue Harness outbox work.
Harness-created channel tool contexts expose normalized channel metadata and
capability flags only; they do not expose authenticated provider SDK clients,
SDK thread handles, raw webhook request/response objects, or adapter handles.
Tests also prove that arbitrary user-authored in-process tool code remains an
authoring/compatibility boundary unless it runs inside a configured restricted
sandbox or capability-injected runtime.

**Provider callback binding durability**

Storage tests prove `resolveProviderCallbackBinding(...)` creates exactly one
active row per `(providerId, selectorKind, selectorValue)`; exact duplicate
returns the existing row; same-key/different-target is a conflict that returns
the existing active owner without overwriting it; replacement atomically creates
the new active row and marks the old row `replaced` with `replacedByBindingId`;
`loadProviderCallbackBindingBySelector(...)` returns only the active binding;
`markProviderCallbackBindingStatus(...)` disables, marks undeliverable,
reactivates only after the registration/uniqueness check, treats `replaced` as
terminal, and preserves provenance.

**Restart before provider callback readiness**

Readiness tests prove bindings are loaded and validated before accepting
callbacks, mismatched `harnessName`/`channelId` bindings are marked
undeliverable, and provider callbacks return unavailable without payload-based
target guessing when required bindings are missing.

**Per-resource tenant mismatch**

Session/thread/wire tests return not-found/scoped errors without leaking
existence.

**Thread clone graph**

Storage/server tests prove `threads.clone(...)` and
`POST /threads/:threadId/clone` load the source only inside the authenticated
`(harnessName, resourceId)`, create a new same-resource thread with fresh
thread/message IDs, preserve message order, write clone provenance, optionally
copy only `metadata.app`, strip reserved top-level runtime/fork/channel
metadata, leave source thread/session state unchanged, copy no
session/channel/queue/pending/wakeup/outbox/tombstone/workspace/memory rows,
reject same-resource `newThreadId` collisions, preserve each cloned attachment
ref's original `ownerSessionId` / `attachmentId` / `sha256`, reject before
writing when a source ref is missing or digest-mismatched or the adapter cannot
atomically register cloned message-history references, reject cloned historical
refs as live inputs to another session, and keep source attachment bytes guarded
through source-session delete while cloned message refs remain.

**Process-local defaults**

Deployment tests or adapter tests distinguish in-memory storage/pubsub/cache/SSE
from durable backends and document unavailable guarantees.

**Restricted sandbox command policy**

Sandbox tests prove that under `commandPolicy: 'restricted'`: unregistered
structured commands and shell-form inputs are refused with `{ exitCode: 127 }`
unless the first token names a configured `shell: true` command; compound,
piped, redirected, command-substituted, leading-env-assignment, or multi-line
shell inputs are refused even when the first token is configured; route
authorization, effective tool `allow`, grants, and `yolo` cannot bypass the
command policy; the same resolution applies before foreground `executeCommand`
and background process-manager spawn paths; the current
`workspace_execute_command` compatibility adapter keeps shell-string inputs in
shell form despite `executeCommand(command, [])`; policy is evaluated on the
post-normalization, post-adapter-rewrite logical command submitted to the
governed command-start path before provider isolation wrapping, and raw
pre-rewrite model text cannot authorize a different final logical start;
provider-owned internal starts either use an explicit non-portable internal
boundary or are subject to the same restricted command policy; browser/CDP
rewrites cannot introduce shell-control syntax or change the first-token owner
after policy approval; replay fails closed when the configured command
policy/map cannot be reconstructed; subagents inheriting the parent workspace
inherit its policy, while fresh subagent workspaces use their configured policy;
configuring `'restricted'` against a sandbox/provider path that cannot interpose
on both foreground and background starts is a construction-time config error.
