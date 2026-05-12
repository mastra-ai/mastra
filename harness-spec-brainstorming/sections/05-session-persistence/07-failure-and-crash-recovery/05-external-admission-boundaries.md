### 5.7e External Admission Boundaries

**External admission boundaries.** Harness does not define one broad
`HarnessAdmission` table in v1. Retrying or autonomous external sources use the
narrowest durable record that owns their failure mode:

Likewise, `IntegrationInbox`, `IntegrationOutbox`, and generic `ActionReceipt`
are pattern names only, not concrete v1 tables or public storage APIs. Concrete
records stay source-specific so their uniqueness, ownership, routing, and
recovery constraints remain explicit.

The repeated `idempotencyKey`, `admissionId`, `responseId`, token, receipt, and
tombstone names below are not independent global idempotency systems. Each is
the boundary for one source's retry, claim, routing, retention, and side-effect
semantics. A generic cross-source idempotency ledger/API is deferred in v1
because it would either flatten those guarantees or recreate the same
source-specific distinctions behind a broader table name.

**Direct HTTP/SDK signal-driven `message(...)` and untyped `useSkill(...)`**

Durable boundary before runtime execution: Optional `admissionId` for
accepted-signal retry de-dupe at the agent signal boundary; no Harness-owned
pre-acceptance record, by design. Untyped `useSkill(...)` resolves the skill,
validates args, expands the prompt, and then uses the same signal boundary.
Exact duplicate skill retries are checked before the fail-fast busy check while
retained signal/tombstone evidence exists. Callers that need restart survival
use `queue(...)`.

**Direct HTTP/SDK `message({ sync: true, output })` and `useSkill({ output })`**

Durable boundary before runtime execution: No retry-safe admission boundary in
v1. These fail-fast paths call the sync generate path, reject `admissionId` with
`HarnessValidationError`, do not create `OperationAdmissionTombstone` rows, and
must not be automatically retried by SDK or server middleware after an ambiguous
transport failure. A future generate-admission receipt would need to specify
in-flight duplicate waiting, terminal result retention, compaction, and
post-tombstone behavior before these routes can claim retry safety.

**Direct HTTP/SDK `queue(...)`**

Durable boundary before runtime execution: `QueuedItem` in
`SessionRecord.pendingQueue`, appended under the session lease, plus a
`QueueAdmissionReceipt` that survives drain/completion for idempotent late
retries.

**Goal continuation after an assistant turn**

Durable boundary before runtime execution: `GoalState.lastDecision` in
`SessionRecord.goal`, then ordinary FIFO `session.queue(...)` with
`continuation.admissionId`. The judge receipt is committed under the session
lease and prevents re-judging the same source turn; the queue receipt owns
continuation ordering and admission after enqueue.

**Channel inbound webhook**

Durable boundary before runtime execution: `ChannelInboxItem`, then
`ChannelBinding`, then `session.message(...)` / `session.queue(...)` with
`admissionId`.

**Channel action callback**

Durable boundary before runtime execution: `ChannelActionToken`, then
`ChannelActionReceipt`, then owning-session inbox response with `responseId`,
backed by `InboxResponseReceipt`.

**Scheduled or proactive channel work**

Durable boundary before runtime execution: A `HarnessWakeupItem` for the wakeup,
then `session.queue(...)` with `admissionId` and durable outbox delivery for
effects. A scheduler that only advances `nextFireAt` and then publishes
best-effort is not enough for autonomous channel guarantees; it must first
create or load the wakeup row so recovery can claim it after a crash between
schedule claim, pubsub publication, workflow start, and session queue admission.
Background task rows alone qualify only when a v1 reconstruction contract covers
both executor and completion path from persisted metadata; current
closure-backed `TaskContext` tasks must sit behind that Harness-owned wakeup
row.

**Future MCP/app callbacks**

Durable boundary before runtime execution: A source-specific inbox or receipt
row with the same invariants: stable idempotency key plus payload hash, trusted
resource/session resolution, claim/retry/dead-letter transitions, and no direct
agent resume APIs before the row is durable. MCP progress notifications,
elicitation requests, resource update/list-change subscriptions, and app
callbacks remain live/process-local until a concrete source owns those rows.


The invariant is the boundary, not the table name: an external retrying source
never calls `agent.stream(...)`, `agent.generate(...)`,
`agent.approveToolCall(...)`, `agent.resumeStream(...)`,
`agent.resumeGenerate(...)`, or a platform delivery API as its public durability
contract.

Background tasks are execution machinery, not another public admission table.
They may carry retrying or autonomous external work only when the runtime can
reconstruct both the executor and completion policy from stable persisted
metadata, or when an owning Harness row remains claimable and can retry the work
if the task instance cannot be reconstructed. A reconstructable task worker must
claim the task row before executor start, renew the claim while running, and
commit completion/failure through the matching claim. A failed claim is a
duplicate dispatch no-op; a lost renewal fences the worker before it runs
completion hooks, mutates a session, makes a provider-visible call, retries, or
writes a terminal task status. A raw background-task row with
`status: 'completed'` is not, by itself, proof that the Harness-visible result
or provider-visible side effect was durably projected. Completion hooks must
write durable session/Harness state or enqueue outbox-producing work before any
external effect depends on them, and claim-guarded completion must not report
success until that durable completion policy has committed.

Before executor start, a reconstructable task worker resolves
`executorRef.id` and `completionPolicyRef.id` against the §9
`backgroundTasks` registries, checks `kind`, validates any stored
executor/completion generations, validates `completionPolicyRef.metadata`
against the registered policy when a validator is configured, and compares
`runtimeCompatibilityGeneration` to the current compatibility domain when the
row carries one. A missing registry entry, wrong kind, generation mismatch,
invalid policy metadata, unavailable tool surface, or runtime generation drift
fails closed with row `error.code = 'runtime_dependency_drifted'` (bare
`HarnessRowErrorCode`, §4.5d) under the current claim; the corresponding
wire-side projection per §13.3f.1 is
`error.code = 'harness.runtime_drift'`. The worker does not execute a
substitute tool, call a process-local
closure, mutate session state, or make provider-visible calls. If retry attempts
remain, the row may become retryable `failed` with its next attempt time;
otherwise it becomes `dead` for operator repair. Diagnostic rows with
`ownerRef` stay behind their owning source row, which owns retry/dead-letter
policy, and remain excluded from `claimBackgroundTasks(...)`.
