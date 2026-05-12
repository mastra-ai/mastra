### 5.5 Lifecycle

This section is the canonical owner for close and delete semantics. The
mechanisms below are intentionally part of the v1 lifecycle contract because
they protect the durability, concurrency, recovery, tenant-isolation, and
subagent invariants verified in §15.1; routes, recovery, concurrency, and
verification sections should cross-reference this section rather than define
alternate close/delete behavior.

The public durable lifecycle state machine is deliberately small. A retained
session record exposes one of three public lifecycle statuses:

- **Active (resumable).** `closingAt: undefined`, `closedAt: undefined`. May or
may not be live in memory.
- **Closing.** `closingAt: <timestamp>`, `closedAt: undefined`. `closeSession`
has committed the bounded close marker and is terminating live work. The record
still occupies the active `(harnessName, resourceId, threadId)` key, but it is
no longer admissible for new work: `message`, `queue`, `useSkill`, inbox
responses, resume calls, descendant creation, `setState`,
mode/model/goal/permission/thread-setting mutations, attachment writes, and
tool-context durable writes reject with `HarnessSessionClosingError`. Read
routes, state snapshots, retained result lookups, event subscriptions, and
idempotent `closeSession` / `deleteSession` repair paths remain available.
- **Closed.** `closedAt: <timestamp>`. Cannot be hydrated as a live `Session`.
`harness.session({ sessionId })` throws `HarnessSessionClosedError`, but
operation result lookup routes may still read retained terminal result/tombstone
evidence for tenant-verified closed records so SDK promises can settle after an
SSE disconnect.
- **Deleted / hidden** is the terminal removal outcome, not a
  `SessionLifecycleStatus` value: the `SessionRecord` is physically gone or
  hidden behind the internal staged-delete behavior described below, and
  public hydration, listing, snapshot, result-lookup, and duplicate-admission
  reads behave as tenant-safe not-found or tenant-hidden.

The legal durable lifecycle transitions are:

- `Active -> Closing` via `session.close()` or
  `harness.closeSession(...)`, committed by the stored `closingAt` marker and
  the §5.8 closing write fence.
- `Closing -> Closed` via terminal close, including crash/lease-loss repair
  that resumes from the stored `closingAt` / `closeDeadlineAt` without
  resetting the deadline.
- `Closed -> Deleted / hidden` via non-force delete only after the target
  subtree and dependent rows satisfy the guarded delete checks below.
- `Active | Closing | Closed -> Deleted / hidden` via force delete, subject to
  the same resource/corruption checks, §5.8 lease/fence rules, delete fence,
  descendant walk, and dependent-ledger cleanup described below.

No backward durable transitions are allowed. A Closed record never becomes
Active or Closing again; thread reuse creates a fresh active session record on
the same thread (§5.3). A Deleted/hidden session is not rehydrated or listed.

The following are not additional durable lifecycle states:

- **Busy / running.** `SessionListItem.busy` and
  `SessionRecord.currentRun.status` values such as `running`, `waiting`, and
  `resuming` are runtime activity projections (§5.1/§5.7). An Active session
  can be busy or idle, and a Closing session can still be aborting live work.
- **Recovering / rehydrating.** Hydration, close repair, and crash recovery are
  transient owner actions (§5.7/§5.8). They do not move a Closing record back to
  Active or create a separate Recovering status; `session_hydrated` is an
  observer event, not a durable transition.
- **Corrupt.** `HarnessSessionCorruptError` is an error or repair condition
  for malformed or inconsistent records (§5.7), not a lifecycle status. Repair
  and force-delete paths use the existing Active/Closing/Closed/Deleted
  transition rules.
- **Evicted.** Idle or pressure eviction is a memory-residency transition
  between Active-in-memory and Active-in-storage-only (§5.4). It releases the
  lease and drops the live cache entry without setting `closingAt`, `closedAt`,
  or any delete marker.
- **Staged delete.** An adapter's internal staged-delete marker is never a
  public lifecycle state; public reads behave as already deleted or
  tenant-hidden while staged cleanup completes.

Active and closing records participate in the
`(harnessName, resourceId, threadId)` uniqueness rule
enforced by `createOrLoadActiveSession(...)` (§5.2). A thread can have many
closed historical records, but at most one non-closed active-key owner.

Detailed transition mechanics:

- `session.close()` (or `harness.closeSession({ sessionId, resourceId })` when
you only have the ID plus its owning resource) — cross-checks `harnessName` and
`resourceId` when supplied and returns tenant-safe not-found on mismatch before
close, force-delete, or closed-record handling. Close is a bounded two-phase
transition over the target session and **all active descendant subagent
sessions** — live or persisted-only — walked recursively via
`listChildSessions(...)` under the parent's `sessionId` in the same Harness
namespace (paging through `nextCursor` when present). The descendant walk uses
the §5.2 `(createdAt ASC, sessionId ASC)` child-session order. During close and
non-force delete, `includeClosed: true` pages must continue to expose a child
whose `closedAt` committed earlier in the same cascade, while force-deleted or
tenant-hidden rows are skipped without retargeting.

  **Enter closing.** The close owner first writes `closingAt` and
  `closeDeadlineAt = closingAt + sessions.closeTimeoutMs` under the parent/root
  lease, using the same storage-authoritative time source as session leases
  (§5.2). The marker is installed top-down over the active subtree before
  aborting live work, so no descendant remains open to new admissions after an
  ancestor is closing. The close deadline is one fixed deadline for the whole
  subtree; it is not reset per descendant or per retry. Entering closing emits
  `session_closing` after the marker commits. The close owner keeps renewing the
  parent/root lease through `renewSessionLeaseSubtree(...)` (§5.2) while
  waiting, so active descendant lease TTLs mirror the parent/root expiry, but
  renewal never extends `closeDeadlineAt`. If renewal fails or another owner
  fences the close owner, the old owner marks local ownership lost and stops
  mutations; a later owner resumes the same close from the stored marker and
  deadline.

  **Abort and settle.** Once the marker is durable, the harness aborts live work
  for the target and every active live descendant with
  `HarnessAbortedError.reason = 'session_closed'`. The owner waits at most until
  `closeDeadlineAt` for cooperative work to settle. Pending queued items are not
  drained during closing; pending approval/suspension/question/plan items are no
  longer answerable; goal continuations and other session-owned durable
  mutations are rejected as closing. Persisted-but-non-live descendants are
  loaded only long enough to apply close terminalization; no agent run or queue
  drain is started on rehydrated cascade targets.

  **Terminal close.** When live work settles or `closeDeadlineAt` is reached,
  the owner applies the terminal close bottom-up (deepest descendants first).
  For each session in the close walk, while the parent/root lease authority is
  still held, it records `queue_failed` for queued items that never crossed the
  signal boundary, records `message_failed` / `queue_failed` for unresolved
  accepted signal-driven operations owned by that session, clears pending item
  fields, marks active channel bindings for that session `closed` with
  `closedReason: 'session_closed'`, settles retained result/tombstone evidence
  for that session, and writes that session's `closedAt`. Only after that
  session's `closedAt` commit may the owner evict its local memory object, when
  one exists. The close target's own `closedAt` is written **last** so the call
  cannot leave orphaned active descendants behind. The parent/root lease
  authority is released only after the close target's `closedAt` commit
  succeeds, or after another owner fences the close owner (§5.8). If
  terminalization fails after `closingAt` has committed, the owner does not
  release the lease voluntarily and does not roll the record back to Active; the
  visible Closing marker remains for idempotent repair by the same owner or a
  later fenced/acquired owner. If a tool or runtime callback later completes
  after the forced close deadline, it cannot flip a terminal failed operation to
  completed, and any Harness write attempts from that process-local work fail as
  stale, closing, or closed. Close does not guarantee cancellation of provider
  calls or arbitrary external side effects already started before abort,
  matching the force-delete caveat for in-flight provider work; it only prevents
  further Harness state changes and provider retries owned by the closed
  session.

  The walk asserts `descendant.harnessName === parent.harnessName` and
  `descendant.resourceId === parent.resourceId` per row and surfaces
  `HarnessSessionCorruptError` on mismatch instead of crossing harnesses/tenants
  or silently skipping. The cascade is idempotent against `closingAt` and
  `closedAt`: concurrent `closeSession` calls observe the same marker and
  deadline, skip already-closed descendants, and complete the rest. If the
  process crashes after `closingAt` but before `closedAt`, re-issuing
  `closeSession(...)` or hydrating/resolving the closing record for close/delete
  repair resumes the stored cascade; if `closeDeadlineAt` has passed, the new
  owner proceeds directly to terminal close without waiting again.
  `closeSession` remains commit-on-return and resolves only after the terminal
  `closedAt` write for the close target has committed. Delete/force-delete uses
  the delete lifecycle below. The ID-only `closeSession({ sessionId })` form is
  reserved for single-tenant local code and explicit operator/admin tooling.
- `harness.deleteSession({ sessionId, resourceId, force })` — hard-removes the
session record after applying a delete fence and dependent-ledger cleanup. The
harness first loads the target inside its bound `harnessName`, cross-checks
`resourceId`, and routes child-session deletes through the parent/root lease
policy in §5.8. If the row is corrupt, resource-scoped force delete is allowed
only when storage can still prove the row's `harnessName` and `resourceId` from
an index or immutable header; otherwise the resource-scoped call fails closed
and only explicit ID-only operator tooling may remove the unscopable row.

  **Non-force delete** (`force` absent or `false`) is a guarded closed-record
  delete. The target and every descendant returned by
  `listChildSessions({ includeClosed: true })` must already have `closedAt` set,
  and the descendant records are deleted bottom-up so no closed child keeps a
  missing `parentSessionId`. The delete is blocked with
  `HarnessSessionDeleteBlockedError` while any of the following remain: a
  live/active descendant; non-empty `pendingQueue`; pending
  approval/suspension/question/plan fields; non-terminal or retryable
  `QueueAdmissionReceipt` or `InboxResponseReceipt`; active channel bindings;
  retryable or claimed `ChannelInboxItem`, `ChannelActionReceipt`,
  `ChannelOutboxItem`, or `HarnessWakeupItem` rows referencing the session
  through `sessionId` or `owningSessionId`; retained attachment references that
  are not about to be deleted with the session; or per-session workspace cleanup
  that cannot be proven complete. Terminal source rows such as accepted/queued
  inbox rows, applied/conflict/dead action receipts, sent/dead outbox rows, and
  skipped/dead wakeups may remain as audit evidence only if they are excluded
  from worker claim scans and exact duplicate lookups return the stored terminal
  state without hydrating the deleted session.

  **Force delete** (`force: true`) is for operator deletion, thread-delete
  cascade, and corruption recovery. It first acquires or fences the owning
  session/root lease using the normal §5.8 lock policy; under default
  `lockMode: 'fail'`, an unexpired different owner blocks the call, while
  operator-only `'steal'` fences that owner. Once fenced, the delete installs a
  storage-level delete fence (or an equivalent transaction boundary) that makes
  new hydration, admission, queue drain, inbox response, wakeup admission, and
  outbox projection fail closed for the target subtree. It then walks all
  descendants with `includeClosed: true`, asserts
  `descendant.harnessName === parent.harnessName` and
  `descendant.resourceId === parent.resourceId`, and applies the same cleanup
  bottom-up. Active descendants get close-style terminal operation settlement
  before their rows are removed; already-closed descendants skip that duplicate
  terminalization. Session-local queue and inbox-response receipts are
  completed, terminalized, hidden, or deleted according to their
  retained-evidence policy before the session row disappears. Source-specific
  rows that still represent work (`ChannelInboxItem`, `ChannelActionReceipt`,
  `ChannelOutboxItem`, `HarnessWakeupItem`) move to terminal `dead`; the row
  records `lastError.code = 'session_deleted'` (bare `HarnessRowErrorCode`
  per §4.5d), release or invalidate any claim under the delete fence, and
  never appear in automatic worker scans again. Any `error` event surfaced
  for these terminalizations carries `error.code = 'harness.session_deleted'`
  per §13.3f.1. Retained `ChannelActionToken` rows for the deleted subtree
  are revoked or hidden with `revokedReason: 'session_deleted'` (also bare
  `HarnessRowErrorCode`) so stale provider callbacks cannot create a
  first-use receipt after deletion; the matching wire-side projection is
  `harness.session_deleted` with `details.cause: 'cascade' | 'force'`. The cascade may bypass the row's ordinary
  worker-claim CAS only inside the same fenced transaction/internal cleanup
  helper; adapters that cannot terminalize an actively claimed row immediately
  keep the delete staged and complete terminalization after the stale worker's
  renewal fails or the claim expires. Rows that were already terminal may be
  retained as audit evidence or deleted according to retention policy, but
  retained rows must stay terminal for point duplicate reads. Active
  `ChannelBinding` rows are marked `closed` with
  `closedReason: 'session_deleted'`; bindings are not automatically replaced or
  retargeted. `OperationAdmissionTombstone` rows are hidden or deleted before
  the session row disappears so result/admission routes return tenant-safe
  not-found rather than `expired`. Attachments for the deleted subtree are
  force-removed after their owning durable rows are terminalized or deleted. A
  materialized `per-session` workspace is destroyed through the configured
  workspace lifecycle when that can be reconstructed; if force delete cannot
  destroy the external workspace, the session row is still removed and the
  external resource is treated as abandoned operator cleanup, not retryable
  Harness work. The `SessionRecord` is removed last.

  Adapters that cannot atomically update every dependent row and remove the
  session in one transaction may use an internal staged delete marker. The
  marker is not a public lifecycle state: `harness.session(...)`,
  `listSessions(...)`, result lookup routes, and duplicate-admission reads must
  behave as though the session is already deleted or tenant-hidden. Recovery
  re-running `deleteSession({ force: true })` completes any unfinished
  terminalization and physical cleanup idempotently. After cleanup completes,
  the marker is removed or retained only as an internal delete tombstone with
  bounded garbage collection; either way it must not make the deleted session
  visible again or affect tenant-visible lookup semantics. Delete does not
  guarantee cancellation of a provider call an outbox worker already started
  before its claim was fenced; it only prevents further row updates/retries
  after the delete fence, leaving provider duplicate behavior to the outbox
  delivery semantics in §14.4.
  Deleting one session does not delete thread-scoped or resource-scoped
  observational-memory rows. A thread can outlive any single session and can be
  reused by a later session, so thread-scoped OM remains attached to the thread
  until the thread itself is deleted.
- `harness.threads.delete({ threadId, resourceId })` — cascades: closes and
force-deletes all sessions bound to that thread after verifying the thread
belongs to `resourceId`, using the same descendant and dependent-ledger cleanup
rules above. After the session cleanup finishes, thread deletion also removes
the thread record, its messages, and thread-scoped observational-memory rows
scoped exactly to the deleted `(harnessName, resourceId, threadId)` when the
configured memory store can represent that scope. Resource-scoped OM is not
deleted by deleting one thread. Child subagent sessions whose `threadId` differs
from the parent are reached through `listChildSessions(...)`, not only by
matching the deleted thread ID.
- Non-lifecycle residency behavior: idle eviction moves between "active in
memory" and "active in storage only," never touches `closingAt`, `closedAt`, or
a delete marker.

**Closed records and thread reuse.** A thread can outlive any single session
that ran on it. After `session.close()` reaches `closedAt`, the thread is still
a valid target for a new session: `harness.session({ threadId, resourceId })`
ignores the closed record and creates a fresh active session bound to the same
`threadId` (see §5.3). A Closing record blocks that reuse until terminal close
commits. Closed records remain in storage as retained history while the
`SessionRecord` exists: they are addressable by `harness.session({ sessionId })`
(which throws `HarnessSessionClosedError`), surfaced by
`harness.listSessions({ resourceId, includeClosed: true })`, and removed only by
an explicit `harness.deleteSession({ sessionId, resourceId })`, by
`harness.threads.delete({ threadId, resourceId })` cascading, or by an
operator/product-owned cleanup routine that calls the same resource-scoped
delete path after its own retention policy. `includeClosed` lists only retained
rows; once the closed row is explicitly deleted or hidden by a staged delete
marker, it disappears from history views. Result lookup for a tenant-verified
closed session returns `completed` / `failed` while full terminal evidence
remains, returns `expired` while only a compact `OperationAdmissionTombstone`
remains, and returns tenant-safe not-found after the session row or required
operation evidence is gone. Routine cleanup should prefer non-force
`deleteSession` so `HarnessSessionDeleteBlockedError` protects unresolved
dependents; explicit operator force-delete remains available under the delete
rules above. `deleteSession({ sessionId, resourceId })` uses the same
tenant-safe resource mismatch behavior as close before applying `force` or
dependent-ledger cleanup rules.

Detach (proactively flush + drop without closing) is not exposed in v1. It
happens implicitly via eviction. If real callers want explicit control later, we
add `harness.detachSession({ sessionId })` in a minor.
