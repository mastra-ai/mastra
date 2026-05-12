### 13.3e Operation Result Lookups

**Operation result lookup responses** back the result routes in §13.2. They are
the recovery path for SDK promises after an SSE replay gap. `message(...)`
settles only from a response keyed by its admitted `signalId`; `queue(...)`
settles only from a response keyed by its `queuedItemId`.

```ts
interface MessageAdmissionResponse {
  kind: 'message';
  runId: string;
  signalId: string;
  duplicate: boolean;
}

interface QueueAdmissionResponse {
  kind: 'queue';
  queuedItemId: string;
  duplicate: boolean;
}
```

`POST /messages` and untyped `POST /skills/:skillName` return
`MessageAdmissionResponse` after signal admission. A first accepted signal
returns `duplicate: false`. An exact retry with the same retained `admissionId`
and hash returns the original `runId` and `signalId` with `duplicate: true`
while retained signal evidence or compact tombstone evidence remains; it does
not accept another signal or include current result payload. Callers use
`GET /message-results/:signalId` for settlement. The stream route carries the
same admitted `runId` / `signalId` in headers before its live SSE body; it does
not turn the live text tail into replayable transcript recovery.

`POST /queue` returns `QueueAdmissionResponse`. A first append returns
`duplicate: false`. An exact retry with the same retained `admissionId` and
hash returns the original `queuedItemId` with `duplicate: true` while the
`QueueAdmissionReceipt` or compact `OperationAdmissionTombstone` remains; it
does not append another item, consume queue capacity, or include `runId`,
`signalId`, current status, or result payload. Callers use
`GET /queue/:queuedItemId/result` for settlement. A same-key/different-hash
retry still fails with `harness.admission_conflict`, and after all receipt /
tombstone evidence expires the old key is no longer recognized.

```ts
type MessageResultResponse =
  | { kind: 'message'; status: 'pending'; signalId: string; runId?: string }
  | { kind: 'message'; status: 'completed'; signalId: string; runId: string; result: AgentResult }
  | { kind: 'message'; status: 'failed'; signalId: string; runId?: string; error: HarnessPublicErrorProjection }
  | { kind: 'message'; status: 'expired'; signalId: string; runId?: string; error: { code: 'harness.result_expired'; message: string } };

type QueueExhaustedErrorProjection = { code: 'harness.queue_exhausted'; message: string };

type QueueResultResponse =
  | {
      kind: 'queue';
      status: 'pending';
      queuedItemId: string;
      // Present once the item has crossed the agent signal boundary and
      // remains in-flight. Absence means the item has not yet produced public
      // accepted-signal evidence.
      runId?: string;
      signalId?: string;
    }
  | { kind: 'queue'; status: 'completed'; queuedItemId: string; runId: string; signalId: string; result: AgentResult }
  | { kind: 'queue'; status: 'failed'; queuedItemId: string; runId?: string; signalId?: string; error: HarnessPublicErrorProjection | QueueExhaustedErrorProjection }
  | { kind: 'queue'; status: 'expired'; queuedItemId: string; runId?: string; signalId?: string; error: { code: 'harness.result_expired'; message: string } };
```

`QueueResultResponse` is a settlement DTO, not the complete queue diagnostic
state machine. Non-terminal receipt states such as `queued`, `admitting`,
retryable `admission_failed`, and accepted/in-flight all return `pending`;
`runId` and `signalId` are the stable public indication that the item has been
accepted by the agent boundary. Queue retry timing, attempt counts, and richer
operator progress remain in durable-work and diagnostic projections rather than
this result route.

`expired` is a terminal operation-result state, not a replay instruction. It is
used only when the server still has `OperationAdmissionTombstone` evidence that
identifies a prior accepted/admitted operation by `signalId` or `queuedItemId`,
but can no longer retain or reconstruct enough result evidence to answer
`completed` or `failed`; unknown, deleted, or unauthorized IDs use the normal
tenant-safe not-found response. The SDK rejects the pending promise with the
supplied error. The full-result retention window and compact tombstone window are
configured in §9, but a lookup must not return `pending` after the server knows
the operation result is unrecoverable. While a tombstone is retained, duplicate
POST admissions with the same `admissionId` and hash return the original
`MessageAdmissionResponse` or the original `QueueAdmissionResponse` as
applicable; same-key/different-hash retries still surface
`harness.admission_conflict`.

For queue lookups, exhausted/dead receipts map to `status: 'failed'` with
`error.code = 'harness.queue_exhausted'`. `expired` is reserved for retained
identity evidence without enough result evidence, not for active retry
exhaustion. `harness.queue_exhausted` and `harness.result_expired` are
result-lookup-only terminal codes, not §4.5 typed Harness classes; ordinary
failed results carry the public Harness error projection so SDK recovery can
rehydrate typed subclasses with details.
