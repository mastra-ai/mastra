### 5.2e Attachment and Source-Ledger Requirements

`deleteAttachment(...)` is the caller-facing "drop unused upload" primitive. It
must atomically reject with `HarnessAttachmentInUseError` while any durable
reference returned by `listAttachmentReferences(...)` remains. The
`sessionId` passed to `listAttachmentReferences(...)` is the attachment owner,
not necessarily the session whose thread is currently reading history; the
returned `message_history` references include cloned message rows in other
threads that retained this owning attachment ref. A delete racing with
queue/inbox/wakeup/message admission or clone reference registration linearizes
with the reference-creating write: either deletion commits before the durable
reference exists, or it observes the reference and fails.
`deleteAttachmentsForSession(...)` deletes only attachments with no durable
references; force cleanup that abandons referenced inputs is part of
`deleteSession`/ledger cleanup in §5.5.
When thread clone copies messages that contain `PersistedAttachment` refs, those
cloned message rows keep the original `ownerSessionId`, `attachmentId`, and
`sha256`; clone does not copy bytes, mint new attachment IDs, or move ownership.
Before committing the new thread, the harness must verify every copied
attachment ref resolves through `(harnessName, ownerSessionId, attachmentId)`
to bytes whose digest matches the stored `sha256`, and the message append plus
guarded-reference registration must be atomic or otherwise all-or-nothing.
Deleting or force-deleting the source session must not remove attachment bytes
while a cloned thread message still references them; if an adapter cannot prove
and maintain that reference graph, clone must reject before writing the new
thread instead of creating messages with dangling attachment refs.

Implementations: in-memory (testing), filesystem (TUI), Postgres / SQLite /
DurableObjects / Redis (servers). Same plug-in pattern as the rest of
`MastraStorage`. Attachment bytes are typically not co-located with row data —
adapters are free to delegate to S3 / R2 / local disk under the same interface,
as long as the Harness attachment metadata and guarded-delete checks stay
transactional with the durable records that reference them.

The channel and wakeup primitives above are the v1 instances of a
source-specific integration ledger pattern. Harness does not expose a generic
`IntegrationInbox` / `IntegrationOutbox` storage API: future external sources
such as MCP callbacks or app webhooks add their own narrow records and storage
methods with source-appropriate ownership keys while preserving the same
idempotency, claim, retry, and dead-letter invariants.

Harness v1 also does not add a standalone `HarnessRun` storage table or separate
`ThreadRuntime` table. The active run pointer is the `SessionRecord.currentRun`
snapshot saved through `saveSession(...)` under the active session lease.
Because storage enforces one active session for
`(harnessName, resourceId, threadId)`, that lease is also the thread/run
admission lease for Harness-owned queue and pending state. Storage adapters do
not need run-level claim or list APIs for v1; workers recover external work by
scanning the source-specific queue, inbox, action, wakeup, and outbox rows, then
acquiring the owning session lease before changing session-local run or pending
state.

`listActiveChannelBindingsForScope(...)` is the channel worker's scalable
discovery primitive for the §14.4 missing-outbox projection pass; the projection
algorithm and delivery-binding semantics are owned by §14.
`enqueueChannelOutbox(...)`
provides the idempotent write boundary for projected rows.
`listChildSessions(...)`
exists so projection can discover subagent-owned pending items after restart and
deliver their prompts through the ancestor/root binding described in §14.5.

Provider-facing durable channels require a backend with persistent atomic
conditional writes, unique constraints, due-row scans, and compare-and-set claim
updates. The in-memory adapter is acceptable for tests and local demos only; it
cannot provide crash recovery across process restarts.

Reconstructable background-task rows follow the same worker-claim discipline as
other claimable Harness rows, without becoming a public admission table.
`claimBackgroundTasks(...)` claims only `ClaimableBackgroundTaskRow` rows where
`durability === 'reconstructable'`: due `pending` or retryable `failed` rows,
plus `running` rows whose previous `claimExpiresAt <= storageNow`. A
`BackgroundTaskDiagnosticRow` row, with or without `ownerRef`, is never claimed
by
these helpers; if it has an `ownerRef`, the referenced
queue/inbox/action/outbox,
response, goal, or wakeup row owns retry and dead-letter behavior. Concurrent
claim attempts produce one current owner. Duplicate dispatch that cannot acquire
the task's current claim no-ops before executor start. A worker renews before
continuing long-running work; if renewal fails, it stops before any further
session mutation, completion hook, provider call, retry transition, or terminal
task update. `updateBackgroundTaskClaim(...)` applies legal claimed transitions
such as completion, retryable failure, timeout, cancellation, or dead-letter
only
while the caller holds the matching `claimId`; cancellation, delete, and
terminal repair invalidate stale completions. Cleanup excludes nonterminal
claimed rows until takeover or terminalization settles them.
