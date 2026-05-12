### 4.5a Admission, Channel, and Inbox Errors

```ts
// Thrown by fail-fast forms (`message({ sync: true, output })`, `useSkill(...)`)
// and by tool-context pending-interaction conflicts (`registerQuestion`,
// `registerPlanApproval`, `suspendTool`). Signal-driven interactive
// `message()` and `queue()` are busy-independent and never throw this error at
// public operation admission.
// For pending-interaction conflicts, `reason` names the already-blocking
// pending kind, not the attempted API.
class HarnessBusyError extends Error {
  readonly sessionId: string;
  readonly reason: 'in_flight' | 'pending_approval' | 'pending_suspension' | 'pending_question' | 'pending_plan';
}

// Thrown by `queue()` when the durable active-session/thread FIFO is at
// `sessions.maxQueueDepth` (§9). The capacity check and the durable append
// are atomic under the active session's write lease (§5.8), so two concurrent
// `queue()` calls cannot both observe space and commit past the cap. This
// is intentionally distinct from `HarnessBusyError` — being busy is not a
// reason `queue()` rejects.
class HarnessQueueFullError extends Error {
  readonly sessionId: string;
  readonly maxQueueDepth: number;
  readonly currentDepth: number;
}

// Thrown at admission for malformed options (e.g. `message({ output, stream: true })`,
// negative `maxTurns` on `setGoal`, attachment exceeding `files.maxInlineBytes`).
// Surfaces before any storage write.
class HarnessValidationError extends Error {
  readonly field: string;
  readonly reason: string;
}

// Thrown by schema-bearing sync generate forms after execution starts when the
// model/runtime cannot produce a successful public typed value. This is not an
// admission-id conflict and does not create retry-safe result evidence in v1.
class HarnessOutputGenerationError extends Error {
  readonly sessionId: string;
  readonly runId?: string;
  readonly reason:
    | 'structured_output_validation_failed'
    | 'structured_output_missing_object'
    | 'tripwire'
    | 'interactive_tool_required'
    | 'model_error';
}

// Thrown or returned over the wire when the authenticated principal lacks the
// capability required for a high-risk operation. Tenant mismatches still use
// tenant-safe not-found; this error is for known resources where authentication
// succeeded but authorization for the specific action failed.
class HarnessForbiddenError extends Error {
  readonly capability: string;
  readonly resourceId?: string;
  readonly sessionId?: string;
}

// Thrown at admission when `message(...)` carries `model`, `mode`, `addTools`,
// or `yolo: true` and would drain into an already-active run. The run's surface
// and run-scoped approval-bypass policy are committed at start time and a
// mid-flight signal cannot mutate them.
// Caller's options: drop the override and resend, abort the live run and
// resend (the next signal starts a fresh run with the override applied), or
// switch to `session.queue(...)` so the override applies to the queued
// standalone turn. See §4.3.
class HarnessOverrideConflictError extends Error {
  readonly sessionId: string;
  readonly activeRunId: string;
  readonly conflictingFields: Array<'model' | 'mode' | 'addTools' | 'yolo'>;
}

// Thrown when a caller retries an operation with an `admissionId` that was
// already accepted for different content/options. Exact duplicate retries
// return the original accepted signal/queue metadata instead.
class HarnessAdmissionConflictError extends Error {
  readonly sessionId: string;
  readonly admissionId: string;
  readonly storedAdmissionHash: string;
  readonly attemptedAdmissionHash: string;
}

// Thrown when deleting a pre-uploaded attachment that is already referenced by
// durable queue, message-history, current-run, channel inbox, wakeup, or outbox
// state. The caller can retry deletion after the owning records age out or are
// explicitly cleaned up by session/delete lifecycle policy.
class HarnessAttachmentInUseError extends Error {
  readonly sessionId: string;
  readonly attachmentId: string;
  readonly references: Array<{ source: string; sourceId: string }>;
}

// Thrown before admission when an input attachment cannot be made replay-safe,
// or during recovery when a persisted attachment ref no longer resolves to the
// recorded bytes/digest. Durable recovery fails the owning operation with this
// typed reason instead of replaying with missing or changed bytes.
class HarnessAttachmentUnavailableError extends Error {
  readonly sessionId: string;
  readonly attachmentId?: string;
  readonly reason:
    | 'not_found'
    | 'fetch_failed'
    | 'fetch_timeout'
    | 'too_large'
    | 'mime_mismatch'
    | 'digest_mismatch'
    | 'unsupported_url'
    | 'redirect_limit_exceeded'
    | 'network_target_blocked'
    | 'blocked_by_policy';
}

// Thrown by channel action handling when a provider callback targets an
// already-recorded action token with a conflicting response. Exact duplicate
// token responses are idempotent and return the original result instead.
class HarnessChannelActionConflictError extends Error {
  readonly harnessName: string;
  readonly channelId: string;
  readonly actionTokenId: string;
  readonly actionId: string;
  readonly itemId: string;
}

class HarnessInboxItemNotFoundError extends Error {
  readonly sessionId: string;
  readonly itemId: string;
  readonly kind?: 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval';
}

class HarnessInboxResponseConflictError extends Error {
  readonly sessionId: string;
  readonly itemId: string;
  readonly responseId: string;
}

// Thrown by `respondToToolSuspension(...)` after the response has already
// won the pending item and the `InboxResponseReceipt` has been durably
// recorded as `accepted`, but the preceding `suspendTool` workflow snapshot is
// not yet observable by the resume boundary. This is a retryable recovery
// deferral, not a rollback: callers, SDKs, channel bridges, or recovery
// workers retry with the same `responseId` (`resumeAttemptId = responseId`).
// Once the snapshot is observable, the resume path advances the receipt to
// `applied`. This error is specific to the `tool-suspension` pending kind;
// other inbox response kinds do not use it.
class HarnessRecoveryDeferredError extends Error {
  readonly sessionId: string;
  readonly itemId: string;
  readonly responseId: string;
  readonly pendingKind: 'tool-suspension';
  readonly reason: 'workflow_snapshot_not_ready';
}

// Thrown by direct local session resolution and wire session-resolve routes
// when `parentSessionId` would create a descendant beyond
// `HarnessConfig.sessions.maxSubagentDepth`. The built-in `subagent` tool does not
// throw this error; it returns a recoverable tool-result failure with the same
// code/details so the parent agent can adapt. See §8 and §13.3.
```
