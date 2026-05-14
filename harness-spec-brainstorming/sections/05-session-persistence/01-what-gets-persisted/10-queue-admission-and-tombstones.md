### 5.1d Queue Admission and Tombstones

```ts
// Items added via `session.message(...)` are NOT persisted here — they go
// straight to `agent.sendSignal(...)` and durability post-acceptance is owned
// by the agent layer (signals are durable by design, with stable IDs and
// replay prevention). Pre-acceptance crashes lose the message; the user
// resends. Slack semantics.
//
// Inline-form FileAttachments are flushed to HarnessStorage.saveAttachment(...)
// before the item is persisted, so the queue contains only references — never
// raw bytes.
interface QueuedItem {
  id: string;                       // unique per session, used for ack/cancel
  admissionId: string;              // caller idempotency key or harness-minted
                                    // recovery key when the caller omitted one
  admissionHash: string;            // stable hash of content, attachments,
                                    // requestContext, and serializable overrides
                                    // used to detect conflicting retries
  enqueuedAt: number;
  content: string;
  attachments: PersistedAttachment[];
  // JSON-shaped request context captured at enqueue time. This lets queued
  // channel/proactive work survive a restart without losing the origin,
  // actor, or platform-thread metadata tools may need. Function-valued
  // context is not allowed here.
  requestContext?: PersistedRequestContextInput;
  // Serializable per-turn overrides captured at enqueue time. §4.3 owns
  // override semantics. `agentId` is intentionally absent: queue items snapshot
  // the requested mode override, not a live agent object. When the item drains,
  // the run-start boundary resolves the effective mode to `HarnessMode.agentId`
  // and records that on `currentRun`. Missing modes or missing agents fail the
  // queue admission/recovery path instead of silently running a different surface.
  model?: string;
  mode?: string;
  yolo?: boolean;
  // `addTools` is intentionally absent; see §4.3.
}

interface QueueAdmissionReceipt {
  admissionId: string;
  admissionHash: string;
  queuedItemId: string;
  status:
    | 'queued'
    | 'admitting'
    | 'accepted'
    | 'completed'
    | 'admission_failed'
    | 'failed'
    | 'dead';
  // Required once `status` is `accepted`, `completed`, or post-acceptance
  // `failed`; absent for pre-acceptance `queued`, `admitting`, and
  // `admission_failed`.
  runId?: string;
  signalId?: string;
  // Serialized public AgentResult (§4.8), stored inline or reconstructed from
  // adapter-owned result evidence before it is returned over public result
  // lookup paths.
  result?: AgentResult;
  error?: { code: string; message: string };
  attempts: number;
  enqueuedAt: number;
  admittingAt?: number;
  acceptedAt?: number;
  completedAt?: number;
  failedAt?: number;
  deadAt?: number;
  nextAttemptAt?: number;
  updatedAt: number;
}

interface OperationAdmissionTombstone {
  kind: 'message' | 'queue';
  harnessName: string;
  sessionId: string;
  resourceId: string;
  threadId: string;
  // Present when the caller or harness supplied a stable admission key. Queue
  // tombstones always retain the queue receipt's admissionId, including the
  // harness-minted key used when the caller omitted one. The `(sessionId,
  // admissionId)` index answers duplicate POST admissions while the tombstone is
  // retained. A same-key/different-hash retry still conflicts.
  admissionId?: string;
  admissionHash?: string;
  // Public result lookup keys. Queue tombstones are findable by `queuedItemId`;
  // message tombstones are findable by `signalId`.
  queuedItemId?: string;
  signalId?: string;
  runId?: string;
  terminalAt: number;
  compactedAt: number;
  expiresAt: number;
}

`OperationAdmissionTombstone` is a compact admission/result index, not a
claimable work row and not a generic integration ledger. It stores identity and
hash evidence only: no message content, attachments, request context, result
payload, full error payload, tool data, or provider metadata. It exists so
storage can compact expensive terminal result evidence without pretending
idempotency is unbounded. Tombstones are retained until
`sessions.admissionTombstoneRetentionMs` and must outlive full receipt/result
evidence when that evidence has been compacted. Explicit session deletion hides
or removes the tombstones with the session so result routes return tenant-safe
not-found rather than `expired`; the broader dependent-ledger cleanup rules are
defined in §5.5.

Signal-driven `message(...)` admissions do not create `SessionRecord` queue
rows, but accepted signals still have a required result-correlation record at
the agent/thread signal boundary. That boundary is keyed by `signalId` and, when
provided, `admissionId`; it records the stable admission hash, `runId`, terminal
status, and either the public `AgentResult` or a durable pointer that can
reconstruct it from persisted thread/run state. That result is the answer
attributable to the accepted signal, not a run-wide aggregate that also answers
other concurrent signals. If attribution cannot be proven, the boundary records
a terminal failure for that `signalId`. If full result evidence is compacted
while the tombstone window remains, the message-result lookup route returns
`expired`. The retained signal record or tombstone is the storage evidence that
supports the §4.4 duplicate/conflict contract; after all tenant-visible evidence
is gone, lookup uses the normal not-found response. The harness projects
`message_completed` / `message_failed` events and the message-result lookup
route from that boundary. `SessionRecord.currentRun` may cache the same
`signalId` for inspection and recovery coordination, but it is not the durable
message-result ledger.

Untyped `useSkill(...)` with an `admissionId` uses that same signal boundary
after skill resolution and prompt expansion. Its `currentRun.operation` may
record `kind: 'use-skill'` plus `skillName`, `admissionId`, `admissionHash`, and
`signalId` for inspection and recovery attribution, but the retained duplicate
and result evidence remains the accepted signal record and, after compaction, a
message-shaped `OperationAdmissionTombstone` keyed by `signalId` and
`admissionId`. Harness v1 does not define a generate-admission receipt for
`message({ sync: true, output })` or `useSkill({ output })`; those paths reject
caller admission IDs and do not create operation tombstones.

`QueueAdmissionReceipt` is the equivalent terminal correlation record for
queued items. Once a queued item drains, the receipt records the accepted
`signalId`; `queue_completed` / `queue_failed` and the queue-result lookup route
read from that receipt plus persisted thread/run state while the receipt is
retained. The receipt or compact `OperationAdmissionTombstone` is the storage
evidence that supports the §4.4 duplicate/conflict contract. If full receipt
evidence is compacted into a tombstone, the queue-result lookup route returns
`expired` by `queuedItemId`. Receipt status `dead` is terminal and maps to
`queue_failed` / `failed` on the wire with an exhausted-retry error until that
failure evidence is compacted; only then can the retained tombstone produce
`expired`.

Goal continuation reuses this queue receipt instead of adding a separate goal
work table. `GoalState.lastDecision` records the judged source turn and, for a
`continue` decision, the deterministic `continuation.admissionId` passed to
`queue(...)`. If hydration finds a `continue` receipt whose matching
`QueuedItem` / `QueueAdmissionReceipt` is missing because the process crashed
between receipt commit and queue append, the session owner appends the
continuation with the same `admissionId` and `admissionHash`. Once the queue
receipt exists, queue recovery owns pre-acceptance retry, post-acceptance run
reconciliation, terminal result lookup, and retention-bounded duplicate
handling. Goal judge receipts are guarded by the owning session lease; they are
not scannable worker rows.

```
