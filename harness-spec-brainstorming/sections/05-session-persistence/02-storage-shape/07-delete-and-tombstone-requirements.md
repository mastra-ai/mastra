### 5.2g Delete and Tombstone Requirements

Session delete cascade requirements: `deleteSession` must be linearized with
session creation, hydration, queue append/drain, inbox response, wakeup
admission, channel ingress/action/outbox updates, outbox projection, attachment
reference checks, and child-session discovery. A backend may satisfy this with a
single transaction, or with an internal staged delete marker that is committed
before dependent cleanup begins. The marker is not a public `SessionRecord`
state; once present, public reads and duplicate/result routes behave as deleted
or tenant-hidden, while workers and retried delete calls can still observe it to
finish cleanup idempotently. Once cleanup finishes, the marker is removed or
retained only as a bounded internal delete tombstone that preserves idempotent
retry without changing public deleted-session behavior.

The delete cascade must cover every durable row whose future work depends on the
deleted session subtree: the target `SessionRecord`, all descendant
`SessionRecord`s returned by `listChildSessions({ includeClosed: true })`,
session-local queue and inbox-response receipts, `OperationAdmissionTombstone`
rows, `ChannelBinding`, `ChannelInboxItem`, `ChannelActionReceipt`,
`ChannelActionToken`, `ChannelOutboxItem` rows referencing the deleted `sessionId` or
`owningSessionId`, `HarnessWakeupItem` rows with the deleted `sessionId` or an
equivalent owning-session field, attachment metadata/bytes for the subtree, and
reconstructable per-session workspace state. Durable adapters therefore need
indexes or internal bulk helpers by `sessionId` and `owningSessionId`; row-by-row
updates are acceptable only when the delete fence prevents new work and stale
claims from continuing. The cleanup must assert every dependent row's
`harnessName` matches the target session before closing, terminalizing, hiding,
or deleting it; a mismatch is storage corruption and fails closed instead of
retargeting the row. Those internal helpers may bypass ordinary worker-claim
CAS only after the delete fence is installed, and the terminal write must
invalidate the previous claim so stale workers cannot later mark the row sent,
applied, queued, or retryable. Adapters that cannot force-terminalize an
unexpired claimed row immediately must keep the staged delete active and finish
the terminal write after claim renewal fails or the claim expires. Terminalized
rows must be excluded from automatic claim scans and exact
duplicate reads must return their stored terminal status/result/conflict without
attempting to hydrate the missing session. Deleting or hiding tombstones must
happen before the `SessionRecord` is physically removed, so deleted-session
lookup uses tenant-safe not-found instead of `expired`.

Admission tombstone storage requirements: compact `OperationAdmissionTombstone`
rows are scoped by `harnessName`, `sessionId`, `resourceId`, and `threadId`;
message tombstones must be findable inside that Harness namespace by `signalId`
and, when present, `(sessionId, admissionId)`; queue tombstones must be findable
by `queuedItemId` and `(sessionId, admissionId)`. The admission-key index
preserves the original `admissionHash` so same-key/different-hash retries still
surface `HarnessAdmissionConflictError` after full result evidence has compacted.
The result helpers above may be backed by indexes over agent signal-result
evidence, `SessionRecord.queueAdmissionReceipts`, separate tombstone rows, or an
adapter-native projection, but they must expose the same precedence: retained
full evidence returns completed/failed evidence, tombstone-only evidence returns
`expired`, and missing/deleted/unauthorized evidence returns tenant-safe
not-found at the route layer. Tombstones are not claimable work and must not
appear in recovery worker scans. Session deletion must call
`deleteOperationAdmissionTombstonesForSession(...)` or an equivalent internal
bulk helper before the `SessionRecord` disappears so deleted-session
result/admission routes return tenant-safe not-found rather than `expired`.
