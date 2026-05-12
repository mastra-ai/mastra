### 5.1b.3 Durable Work Summary

```ts
interface DurableWorkSummary {
  kind: DurableWorkKind;
  status: DurableWorkStatus;
  // Describes the proof behind this row, not a new recovery guarantee.
  // `durable` means the referenced source-specific row/result boundary is the
  // authority. `best-effort` and `live-only` are advisory diagnostics and never
  // settle SDK promises or prove provider-visible completion.
  sourceDurability: 'durable' | 'best-effort' | 'live-only';
  proof: {
    kind: DurableWorkProofKind;
    // Public-safe stable identifier such as signalId, queuedItemId, wakeup id,
    // inbox/action/outbox id, responseId, or a task id. This is not a raw row
    // dump, not a claim id, and not permission to read unscoped storage.
    id: string;
  };
  sessionId: string;
  threadId: string;
  resourceId: string;
  owningSessionId?: string;
  runId?: string;
  signalId?: string;
  queuedItemId?: string;
  wakeupId?: string;
  inboxItemId?: string;
  outboxItemId?: string;
  actionReceiptId?: string;
  responseId?: string;
  taskId?: string;
  createdAt?: number;
  updatedAt?: number;
  nextAttemptAt?: number;
  claimExpiresAt?: number;
  attempts?: number;
  autoRecovery: boolean;
  lastError?: { code: HarnessRowErrorCode; retryable?: boolean };
}

`DurableWorkStatus` is a read-model projection only. It is not a storage enum,
generic work ledger, event type, operation-settlement state, or recovery state
machine. Every value is derived from the source-specific authority named by
`proof.kind`; if the source evidence is ambiguous, the projection must choose
the less final status or omit the row rather than invent completion.
The projection emits at most one active or recoverable `DurableWorkSummary` for
one logical operation chain. Source rows that hand off to a downstream boundary
are handoff evidence, not parallel active work: once the downstream signal,
queue receipt, inbox response, or other source-authoritative proof exists, that
downstream proof governs the active/recoverable status. The upstream handoff row
may appear only as bounded recent terminal context, or be omitted when the
downstream proof fully subsumes it.

Projection rules:

**Accepted signal / message-result evidence**

Source state: pending accepted signal

`DurableWorkStatus`: `admitted`

Notes: The signal crossed admission, but no terminal result is known.

**Accepted signal / message-result evidence**

Source state: completed

`DurableWorkStatus`: `completed`

Notes: Result lookup and `message_completed` remain the settlement authorities.

**Accepted signal / message-result evidence**

Source state: failed or interrupted

`DurableWorkStatus`: `failed`

Notes: A run-level lifecycle event alone is not enough evidence.

**`OperationAdmissionTombstone`**

Source state: retained identity only

`DurableWorkStatus`: `expired`

Notes: Only after fuller result or receipt evidence has compacted while
tombstone evidence remains; if that fuller evidence is still retained, its
projection is authoritative and the tombstone is suppressed. Deleted or
unauthorized sources are omitted/hidden.

**`QueueAdmissionReceipt`**

Source state: `queued`

`DurableWorkStatus`: `queued`

Notes: Durable FIFO append exists, but signal admission has not started.

**`QueueAdmissionReceipt`**

Source state: `admitting`

`DurableWorkStatus`: `admitting`

Notes: Queue drain may be calling `sendSignal(...)`; retry uses the same
admission hash.

**`QueueAdmissionReceipt`**

Source state: `accepted`

`DurableWorkStatus`: `running`

Notes: The queue item has crossed the signal boundary and is awaiting terminal
evidence.

**`QueueAdmissionReceipt`**

Source state: `completed`

`DurableWorkStatus`: `completed`

Notes: Queue result lookup and `queue_completed` remain authoritative.

**`QueueAdmissionReceipt`**

Source state: retryable `admission_failed`

`DurableWorkStatus`: `retrying`

Notes: Requires retained retry policy evidence such as `nextAttemptAt`.

**`QueueAdmissionReceipt`**

Source state: non-retryable `admission_failed` or post-acceptance `failed`

`DurableWorkStatus`: `failed`

Notes: The distinction remains on the source receipt.

**`QueueAdmissionReceipt`**

Source state: `dead`

`DurableWorkStatus`: `dead`

Notes: Exhausted queue admission/recovery maps to queue failure until compacted.

**`HarnessRunOperationalState`**

Source state: `starting`

`DurableWorkStatus`: `admitting`

Notes: `currentRun` is an inspection/recovery pointer, not result evidence, and
is omitted when another proof row already owns the same operation.

**`HarnessRunOperationalState`**

Source state: `running`

`DurableWorkStatus`: `running`

Notes: Use `sourceDurability: 'best-effort'` only when no queue receipt,
accepted-signal evidence, inbox response receipt, channel row, wakeup row, or
reconstructable task row owns settlement for the same operation.

**`HarnessRunOperationalState`**

Source state: `waiting`

`DurableWorkStatus`: `waiting`

Notes: The authoritative pending payload remains in the typed pending fields;
omit this projection when an inbox response receipt owns resume status.

**`HarnessRunOperationalState`**

Source state: `resuming`

`DurableWorkStatus`: `resuming`

Notes: Resume settlement is owned by `InboxResponseReceipt` and the pending
response path; omit this projection when that receipt exists.

**`HarnessRunOperationalState`**

Source state: `completed`

`DurableWorkStatus`: `completed`

Notes: Only as a projection; result lookup still needs operation-specific
evidence.

**`HarnessRunOperationalState`**

Source state: `failed` or `interrupted`

`DurableWorkStatus`: `failed`

Notes: Fail-closed/interrupted detail stays in `currentRun.error` / source rows.

**`ChannelInboxItem`**

Source state: `received`

`DurableWorkStatus`: `queued`

Notes: Provider event is durable and waiting for bridge processing.

**`ChannelInboxItem`**

Source state: `admitted`

`DurableWorkStatus`: `admitting`

Notes: Session admission is in progress or recoverable.

**`ChannelInboxItem`**

Source state: `accepted` or `queued`

`DurableWorkStatus`: `completed`

Notes: The ingress row has handed off to message/queue; later operation status
comes from the signal or queue receipt row.

**`ChannelInboxItem`**

Source state: retryable `failed`

`DurableWorkStatus`: `retrying`

Notes: Requires `nextAttemptAt` / retryable error evidence.

**`ChannelInboxItem`**

Source state: non-retryable `failed`

`DurableWorkStatus`: `failed`

Notes: The row has not reached a terminal dead-letter state.

**`ChannelInboxItem`**

Source state: `dead`

`DurableWorkStatus`: `dead`

Notes: Provider event will not be admitted without operator/product repair.

**`ChannelActionReceipt`**

Source state: `received`

`DurableWorkStatus`: `queued`

Notes: Action callback is durable and waiting to apply.

**`ChannelActionReceipt`**

Source state: `accepted`

`DurableWorkStatus`: `resuming`

Notes: The response won the pending item; resume/apply is not complete.

**`ChannelActionReceipt`**

Source state: `applied`

`DurableWorkStatus`: `completed`

Notes: The pending response path completed.

**`ChannelActionReceipt`**

Source state: `conflict`

`DurableWorkStatus`: `failed`

Notes: Conflict is terminal for that response attempt, but not a retryable
worker failure.

**`ChannelActionReceipt`**

Source state: retryable `failed`

`DurableWorkStatus`: `retrying`

Notes: Requires `nextAttemptAt` / retryable error evidence.

**`ChannelActionReceipt`**

Source state: non-retryable `failed`

`DurableWorkStatus`: `failed`

Notes: Detailed conflict/dead-letter reason stays on the receipt.

**`ChannelActionReceipt`**

Source state: `dead`

`DurableWorkStatus`: `dead`

Notes: Exhausted action apply/recovery.

**`ChannelOutboxItem`**

Source state: `pending`

`DurableWorkStatus`: `queued`

Notes: Provider-visible delivery work is durable but unclaimed.

**`ChannelOutboxItem`**

Source state: `claimed`

`DurableWorkStatus`: `claimed`

Notes: A dispatcher owns the current attempt while its claim is valid.

**`ChannelOutboxItem`**

Source state: `sent`

`DurableWorkStatus`: `delivered`

Notes: Provider-visible delivery succeeded according to the adapter row.

**`ChannelOutboxItem`**

Source state: retryable `failed`

`DurableWorkStatus`: `retrying`

Notes: Requires `nextAttemptAt`; dispatch has not reached final failure.

**`ChannelOutboxItem`**

Source state: non-retryable `failed` or `dead` without sent evidence

`DurableWorkStatus`: `undelivered`

Notes: Provider side-effect success is not proven; exact diagnostics stay on the
outbox row.

**`InboxResponseReceipt`**

Source state: `accepted`

`DurableWorkStatus`: `resuming`

Notes: The response is durable and should resume by `responseId`.

**`InboxResponseReceipt`**

Source state: `applied`

`DurableWorkStatus`: `completed`

Notes: Pending response application completed.

**`InboxResponseReceipt`**

Source state: retryable `failed`

`DurableWorkStatus`: `retrying`

Notes: Requires retained retry evidence.

**`InboxResponseReceipt`**

Source state: non-retryable `failed`

`DurableWorkStatus`: `failed`

Notes: Resume failed without dead-lettering.

**`InboxResponseReceipt`**

Source state: `dead`

`DurableWorkStatus`: `dead`

Notes: Unsupported or exhausted resume recovery.

**`HarnessWakeupItem`**

Source state: `due`

`DurableWorkStatus`: `queued`

Notes: Durable scheduled/proactive occurrence is waiting for a worker.

**`HarnessWakeupItem`**

Source state: `claimed`

`DurableWorkStatus`: `claimed`

Notes: A wakeup worker owns the current attempt while its claim is valid.

**`HarnessWakeupItem`**

Source state: `queued`

`DurableWorkStatus`: `completed`

Notes: The wakeup handed off to `queue(...)`; queue status is separate.

**`HarnessWakeupItem`**

Source state: `skipped`

`DurableWorkStatus`: `completed`

Notes: Intentionally terminal non-run; skipped reason remains source detail.

**`HarnessWakeupItem`**

Source state: retryable `failed`

`DurableWorkStatus`: `retrying`

Notes: Requires `nextAttemptAt` / retryable error evidence.

**`HarnessWakeupItem`**

Source state: non-retryable `failed`

`DurableWorkStatus`: `failed`

Notes: The row is failed but not dead-lettered.

**`HarnessWakeupItem`**

Source state: `dead`

`DurableWorkStatus`: `dead`

Notes: Exhausted wakeup recovery.

**`GoalState.lastDecision` plus queue receipt**

Source state: `continue` decision before queue append

`DurableWorkStatus`: `admitting`

Notes: Only while repairing the deterministic queue append.

**`GoalState.lastDecision` plus queue receipt**

Source state: queue receipt exists

`DurableWorkStatus`: queue receipt mapping

Notes: The continuation queue receipt governs; the goal decision receipt is not
projected as a second work state machine.

**`BackgroundTaskReconstructableRow`**

Source state: `pending`

`DurableWorkStatus`: `queued`

Notes: Only reconstructable rows are independent durable work.

**`BackgroundTaskReconstructableRow`**

Source state: `running`

`DurableWorkStatus`: `running`

Notes: Claim fields prove the active attempt.

**`BackgroundTaskReconstructableRow`**

Source state: `completed`

`DurableWorkStatus`: `completed`

Notes: Completion is scoped to the reconstructable task row.

**`BackgroundTaskReconstructableRow`**

Source state: retryable `failed`

`DurableWorkStatus`: `retrying`

Notes: Requires `nextAttemptAt` and remaining attempts.

**`BackgroundTaskReconstructableRow`**

Source state: non-retryable `failed`, `cancelled`, or `timed_out`

`DurableWorkStatus`: `failed`

Notes: Task-specific reason stays on the task row.

**`BackgroundTaskReconstructableRow`**

Source state: `dead`

`DurableWorkStatus`: `dead`

Notes: Exhausted reconstructable task recovery.

**`BackgroundTaskDiagnosticRow`**

Source state: any

`DurableWorkStatus`: owner source mapping

Notes: Diagnostic rows are not projected independently; `ownerRef` must resolve
to an authoritative Harness row. If the owner row has compacted away, been
deleted, or become tenant-hidden, omit the diagnostic row.


`retrying` is always computed from retained source retry evidence, usually a
retryable failure plus `nextAttemptAt`; a stale due retry that is immediately
claimable may instead project as `queued` or `claimed` according to the source
row and worker claim state. `blocked` is reserved for non-terminal source rows
that are parked behind a durable dependency or capacity condition, such as an
unavailable registered component, undeliverable binding, or live-session-cap
backpressure. If the source row only says "failed and retry later," use
`retrying`; if attempts are exhausted, use the source terminal mapping.
`expired`
is used only for retained operation identity after full result evidence has
compacted; it is not a generic retention state for channel, wakeup, or
background-task rows.

```
