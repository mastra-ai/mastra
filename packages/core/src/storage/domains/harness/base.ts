import { StorageDomain } from '../base';
import {
  normalizeHarnessSessionRecordProjectionConfig,
  type NormalizedHarnessSessionRecordProjectionConfig,
} from './session-record-projection';
import type {
  AcquireSessionLeaseInput,
  AckSessionRecordProjectionInput,
  AckSessionRecordProjectionResult,
  AgentSignalResultEvidence,
  AgentSignalDispatchState,
  AppendWorkspaceActionJournalEntryResult,
  AttachmentReference,
  AttachmentRecord,
  ChannelActionInitialClaim,
  ChannelActionReceipt,
  ChannelActionToken,
  ChannelDiagnosticsRows,
  ChannelOutboxItem,
  ChannelProviderDeliveryReceipt,
  ChannelBinding,
  ResolveChannelBindingResult,
  ListActiveChannelBindingsResult,
  HarnessProviderCallbackBinding,
  ChannelInboxInitialClaim,
  ChannelInboxItem,
  CountPlanTasksByStatusInput,
  CreatePlanTaskInput,
  DeletePlanTaskSubtreeInput,
  DeletePlanTaskSubtreeResult,
  HarnessPlanTask,
  ListPlanTasksInput,
  ListPlanTasksResult,
  LoadPlanTaskSubtreeInput,
  LoadPlanTaskSubtreeResult,
  PlanTaskCountSummary,
  HarnessRunSummary,
  SaveRunSummaryInput,
  LoadRunSummaryInput,
  ListRunSummariesInput,
  ListRunSummariesResult,
  MutatePlanTasksForSessionInput,
  UpdatePlanTaskInput,
  UpdatePlanTaskResult,
  CreateOrLoadChannelActionReceiptResult,
  CreateOrLoadChannelActionTokenResult,
  CreateOrLoadChannelInboxItemResult,
  CreateOrLoadHarnessWakeupItemResult,
  CreateOrLoadActiveSessionOptions,
  CreateOrLoadActiveSessionResult,
  ClaimSessionRecordProjectionIntentsInput,
  DeleteSessionOptions,
  EnqueueChannelOutboxResult,
  HarnessRowErrorCode,
  HarnessSessionEventRecord,
  HarnessSessionEventReplayState,
  HarnessSessionRecordProjectionOption,
  HarnessSessionRecordProjectionIntent,
  HarnessWakeupClaimStatus,
  HarnessWakeupInitialClaim,
  HarnessWakeupItem,
  ListActiveSessionsByThreadInput,
  ListChannelDiagnosticsInput,
  ListDuePendingInteractionsInput,
  ListDuePendingInteractionsResult,
  ListSessionsByThreadInput,
  ListSessionsInput,
  ListWorkspaceActionJournalInput,
  LoadedAttachment,
  OperationAdmissionEvidence,
  OperationAdmissionTombstone,
  ProviderCallbackSelectorKind,
  QueueAdmissionReceipt,
  ReleaseSessionLeaseInput,
  ResolveProviderCallbackBindingResult,
  RenewSessionLeaseInput,
  RenewSessionLeaseSubtreeInput,
  RenewSessionRecordProjectionClaimInput,
  SaveAttachmentInput,
  SaveAttachmentReferenceInput,
  SaveAttachmentResult,
  SaveSessionOptions,
  SaveSessionResult,
  FailSessionRecordProjectionInput,
  SessionRecordProjectionQueuePressure,
  SessionRecordProjectionQueuePressureInput,
  SessionLeaseResult,
  SubtreeSessionLeaseResult,
  SessionRecord,
  SessionSummary,
  ThreadDeleteFenceLease,
  WithThreadDeleteFenceInput,
  WorkspaceActionJournalEntry,
} from './types';

/** Hard storage-side page ceiling for pending-interaction expiry discovery. */
export const HARNESS_PENDING_INTERACTION_DUE_SCAN_MAX_LIMIT = 100;

/**
 * Validate and cap a due-scan request before an adapter allocates or queries.
 * Kept in the storage domain so every adapter enforces identical bounds.
 */
export function normalizePendingInteractionDueScanInput(input: ListDuePendingInteractionsInput): {
  now: number;
  limit: number;
  cursor?: { dueAt: number; sessionId: string };
} {
  if (!Number.isSafeInteger(input.now) || input.now < 0) {
    throw new RangeError('Pending-interaction due scan now must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(input.limit) || input.limit <= 0) {
    throw new RangeError('Pending-interaction due scan limit must be a positive safe integer');
  }
  if (input.cursor !== undefined) {
    if (!Number.isSafeInteger(input.cursor.dueAt) || input.cursor.dueAt < 0) {
      throw new RangeError('Pending-interaction due scan cursor dueAt must be a non-negative safe integer');
    }
    if (input.cursor.sessionId.length === 0) {
      throw new RangeError('Pending-interaction due scan cursor sessionId must not be empty');
    }
  }
  return {
    now: input.now,
    limit: Math.min(input.limit, HARNESS_PENDING_INTERACTION_DUE_SCAN_MAX_LIMIT),
    ...(input.cursor ? { cursor: input.cursor } : {}),
  };
}

export interface WriteMessageResultEvidenceResult {
  created: boolean;
  /** True only when this write changed the durable evidence row. */
  applied: boolean;
  evidence?: AgentSignalResultEvidence;
}

export interface CompareAndSwapSignalDispatchInput {
  harnessName?: string;
  sessionId: string;
  resourceId: string;
  threadId: string;
  signalId: string;
  admissionId: string;
  admissionHash: string;
  expected: AgentSignalDispatchState;
  next: AgentSignalDispatchState;
  updatedAt: number;
}

export interface CompareAndSwapSignalDispatchResult {
  applied: boolean;
  evidence: AgentSignalResultEvidence;
}

export interface CompareAndSwapSignalTerminalInput {
  harnessName?: string;
  sessionId: string;
  resourceId: string;
  threadId: string;
  signalId: string;
  admissionId: string;
  admissionHash: string;
  expected: AgentSignalDispatchState;
  terminal:
    | {
        status: 'completed';
        signalId: string;
        runId: string;
        result: unknown;
        modeId?: string;
        modelId?: string;
      }
    | {
        status: 'failed';
        signalId: string;
        runId?: string;
        error: { code: string; message: string };
        modeId?: string;
        modelId?: string;
      };
  updatedAt: number;
}

export interface CompareAndSwapSignalTerminalResult {
  applied: boolean;
  /** The durable winner, whether this writer applied or lost the fence. */
  evidence: AgentSignalResultEvidence;
}

/**
 * §14.1: missing optional external IDs normalise to this out-of-band sentinel so
 * the platform-conversation tuple stays unique without relying on SQL NULL
 * uniqueness semantics. The U+001F (Unit Separator) prefix is a C0 control
 * character no provider emits in a real external id (including a literal single
 * space), so an absent external id never collides with a present one in storage
 * tuple keys, channel idempotency keys, or derived thread ids. NUL (U+0000) is
 * deliberately avoided: the LibSQL driver rejects NUL bytes in string args.
 *
 * Storage adapters and the harness channel id-derivation must share this exact
 * constant so the storage tuple key and the harness-level idempotency/thread-id
 * keys agree on the missing-external-id encoding.
 */
export const CHANNEL_BINDING_EXTERNAL_ID_SENTINEL = '__mastra_missing_external_id__';

/**
 * Shared base for every storage-domain harness error. Each subclass carries a
 * fully-namespaced `harness.storage.*` wire `code` and a constructed, safe
 * message (ids / status names / a harness-built `reason` — never raw driver,
 * SQL, or filesystem text). Membership is by INSTANCE: the public-error
 * projection (`projectHarnessPublicError`, §13.3f.1) trusts `err instanceof
 * HarnessStorageDomainError` to pass `code` + `message` through, so these
 * adapter-thrown errors surface their specific `harness.storage.*` code instead
 * of collapsing to the reserved `harness.internal` when they reach a public
 * boundary directly (e.g. the channel ingress / recovery-worker paths, which do
 * NOT rewrap into the §4.5d `HarnessStorageError`). A forged `.code` on a raw
 * `Error` is NOT a `HarnessStorageDomainError` instance, so it stays redacted.
 *
 * This is distinct from the §4.5d `HarnessStorageError` (in `harness/v1/errors`),
 * which is the harness-domain wrapper used on session paths and projects to the
 * generic `harness.storage` code while keeping its raw `cause` local-only.
 */
export abstract class HarnessStorageDomainError extends Error {
  abstract readonly code: string;
}

/**
 * Thrown by `saveSession` when `ifVersion` does not match the record's
 * current `version`. The caller should rehydrate and retry once
 * (HARNESS_V1_SPEC.md §5.8).
 */
export class HarnessStorageVersionConflictError extends HarnessStorageDomainError {
  readonly name: string = 'HarnessStorageVersionConflictError';
  readonly code: 'harness.storage.version_conflict' | 'harness.storage.delete_guard_conflict' =
    'harness.storage.version_conflict';
  constructor(
    public readonly sessionId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
  ) {
    super(`Session "${sessionId}" version conflict: expected ${expectedVersion}, found ${actualVersion}`);
  }
}

export type HarnessStorageDeleteGuardField =
  | 'ifVersion'
  | 'expectedResourceId'
  | 'expectedThreadId'
  | 'expectedParentSessionId'
  | 'expectedCreatedAt'
  | 'requireClosed';

export class HarnessStorageDeleteGuardConflictError extends HarnessStorageVersionConflictError {
  override readonly name = 'HarnessStorageDeleteGuardConflictError';
  override readonly code = 'harness.storage.delete_guard_conflict' as const;
  readonly guardCode = 'harness.storage.delete_guard_conflict' as const;
  constructor(
    sessionId: string,
    public readonly guard: HarnessStorageDeleteGuardField,
    expectedVersion: number,
    actualVersion: number,
  ) {
    super(sessionId, expectedVersion, actualVersion);
    this.message = `Session "${sessionId}" delete guard conflict on ${guard}`;
  }
}

/**
 * Thrown by `acquireSessionLease` / `renewSessionLease` / `releaseSessionLease`
 * / `saveSession` when another owner currently holds the lease.
 */
export class HarnessStorageLeaseConflictError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageLeaseConflictError';
  readonly code = 'harness.storage.lease_conflict' as const;
  constructor(
    public readonly sessionId: string,
    public readonly heldBy: string,
    public readonly expiresAt: number,
  ) {
    super(`Session "${sessionId}" lease held by "${heldBy}" until ${new Date(expiresAt).toISOString()}`);
  }
}

/**
 * Thrown by guarded attachment delete when durable references still point at
 * the bytes. The harness layer maps this to the public
 * `HarnessAttachmentInUseError`.
 */
export class HarnessStorageAttachmentInUseError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageAttachmentInUseError';
  readonly code = 'harness.storage.attachment_in_use' as const;
  constructor(
    public readonly sessionId: string,
    public readonly attachmentId: string,
    public readonly references: AttachmentReference[],
  ) {
    super(`Attachment "${attachmentId}" for session "${sessionId}" is still referenced`);
  }
}

export class HarnessStorageAttachmentUnavailableError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageAttachmentUnavailableError';
  readonly code = 'harness.storage.attachment_unavailable' as const;
  constructor(
    public readonly sessionId: string,
    public readonly attachmentId: string,
  ) {
    super(`Attachment "${attachmentId}" for session "${sessionId}" is not available`);
  }
}

/**
 * The native attachment metadata is durable, but its external byte operation
 * has not reached a verified terminal outcome. Callers may retry the same
 * immutable operation; they must not treat this as a successful attachment.
 */
export class HarnessStorageAttachmentPendingError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageAttachmentPendingError';
  readonly code = 'harness.storage.attachment_pending' as const;
  constructor(
    public readonly sessionId: string,
    public readonly attachmentId: string,
  ) {
    super(`Attachment "${attachmentId}" for session "${sessionId}" has a pending external operation`);
  }
}

/** An immutable attachment id was reused with different metadata or bytes. */
export class HarnessStorageAttachmentConflictError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageAttachmentConflictError';
  readonly code = 'harness.storage.attachment_conflict' as const;
  constructor(
    public readonly sessionId: string,
    public readonly attachmentId: string,
  ) {
    super(`Attachment "${attachmentId}" for session "${sessionId}" conflicts with stored identity`);
  }
}

/** The configured byte owner is absent or returned an unusable external object. */
export class HarnessStorageAttachmentByteOwnerError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageAttachmentByteOwnerError';
  readonly code = 'harness.storage.attachment_byte_owner' as const;
  constructor(
    public readonly sessionId: string,
    public readonly attachmentId: string,
  ) {
    super(`Attachment "${attachmentId}" for session "${sessionId}" has no verified external byte owner`);
  }
}

/**
 * Thrown by lease/attachment operations when the targeted session record
 * does not exist in storage.
 */
export class HarnessStorageSessionNotFoundError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageSessionNotFoundError';
  readonly code = 'harness.storage.session_not_found' as const;
  constructor(public readonly sessionId: string) {
    super(`Session "${sessionId}" not found in harness storage`);
  }
}

/**
 * Thrown by `updatePlanTask` / `mutatePlanTasksForSession` when a plan-task row
 * targeted by `taskId` does not exist for the owning session (§5.1k).
 */
export class HarnessStoragePlanTaskNotFoundError extends HarnessStorageDomainError {
  readonly name = 'HarnessStoragePlanTaskNotFoundError';
  readonly code = 'harness.storage.plan_task_not_found' as const;
  constructor(
    public readonly sessionId: string,
    public readonly taskId: string,
  ) {
    super(`Plan task "${taskId}" not found for session "${sessionId}"`);
  }
}

/**
 * Thrown by a plan-task field write when the supplied per-row `ifVersion` does
 * not match the row's current `version`. This is the field-write OCC token that
 * runs INSIDE the session-owner fence (§5.8); a session-level conflict surfaces
 * as `HarnessStorageVersionConflictError` and a wrong/expired owner as
 * `HarnessStorageLeaseConflictError`.
 */
export class HarnessStoragePlanTaskVersionConflictError extends HarnessStorageDomainError {
  readonly name = 'HarnessStoragePlanTaskVersionConflictError';
  readonly code = 'harness.storage.plan_task_version_conflict' as const;
  constructor(
    public readonly taskId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
  ) {
    super(`Plan task "${taskId}" version conflict: expected ${expectedVersion}, found ${actualVersion}`);
  }
}

export class HarnessStorageParentSessionUnavailableError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageParentSessionUnavailableError';
  readonly code = 'harness.storage.parent_session_unavailable' as const;
  constructor(
    public readonly parentSessionId: string,
    public readonly reason: 'not_found' | 'closed' | 'closing',
    /** Closing window for the parent when `reason === 'closing'`, so callers can
     * surface a spec-accurate `HarnessSessionClosingError` (§4.5b). */
    public readonly closingAt?: number,
    public readonly closeDeadlineAt?: number,
  ) {
    super(`Parent session "${parentSessionId}" is unavailable for child admission: ${reason}`);
  }
}

export class HarnessStorageAdmissionConflictError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageAdmissionConflictError';
  readonly code = 'harness.storage.admission_conflict' as const;
  constructor(
    public readonly sessionId: string,
    public readonly kind: 'signal' | 'queue',
    public readonly admissionId: string,
  ) {
    super(`Admission "${admissionId}" for ${kind} in session "${sessionId}" conflicts with stored evidence`);
  }
}

export class HarnessStorageThreadDeleteFenceConflictError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageThreadDeleteFenceConflictError';
  readonly code = 'harness.storage.thread_delete_fence_conflict' as const;
  constructor(
    public readonly threadId: string,
    public readonly ownerId?: string,
  ) {
    super(`Thread "${threadId}" is currently fenced for deletion`);
  }
}

export class HarnessStorageThreadDeleteFenceUnsupportedError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageThreadDeleteFenceUnsupportedError';
  readonly code = 'harness.storage.thread_delete_fence_unsupported' as const;
  constructor() {
    super('HarnessStorage.withThreadDeleteFence must be implemented by this storage adapter');
  }
}

export class HarnessStorageSessionEventReplayUnsupportedError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageSessionEventReplayUnsupportedError';
  readonly code = 'harness.storage.session_event_replay_unsupported' as const;
  constructor() {
    super('HarnessStorage session event replay must be implemented by this storage adapter');
  }
}

export class HarnessStorageSubtreeLeaseRenewalUnsupportedError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageSubtreeLeaseRenewalUnsupportedError';
  readonly code = 'harness.storage.subtree_lease_renewal_unsupported' as const;
  constructor() {
    super(
      'HarnessStorage.renewSessionLeaseSubtree must be implemented atomically by this storage adapter ' +
        '(single storage-linearized cycle over the root + active descendants — see §5.8)',
    );
  }
}

export class HarnessStorageWorkspaceActionJournalUnsupportedError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageWorkspaceActionJournalUnsupportedError';
  readonly code = 'harness.storage.workspace_action_journal_unsupported' as const;
  constructor() {
    super('HarnessStorage workspace action journal must be implemented by this storage adapter');
  }
}

export class HarnessStoragePlanTaskUnsupportedError extends HarnessStorageDomainError {
  readonly name = 'HarnessStoragePlanTaskUnsupportedError';
  readonly code = 'harness.storage.plan_task_unsupported' as const;
  constructor() {
    super('HarnessStorage plan tasks must be implemented by this storage adapter');
  }
}

export class HarnessStorageRunSummaryUnsupportedError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageRunSummaryUnsupportedError';
  readonly code = 'harness.storage.run_summary_unsupported' as const;
  constructor() {
    super('HarnessStorage run summaries must be implemented by this storage adapter');
  }
}

export class HarnessStorageChannelDiagnosticsUnsupportedError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageChannelDiagnosticsUnsupportedError';
  readonly code = 'harness.storage.channel_diagnostics_unsupported' as const;
  constructor() {
    super('HarnessStorage channel diagnostics must be implemented by this storage adapter');
  }
}

export class HarnessStorageSignalDispatchUnsupportedError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageSignalDispatchUnsupportedError';
  readonly code = 'harness.storage.signal_dispatch_unsupported' as const;
  constructor() {
    super('Harness storage adapter does not support durable signal dispatch fencing');
  }
}

export class HarnessStorageChannelBindingUnsupportedError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageChannelBindingUnsupportedError';
  readonly code = 'harness.storage.channel_binding_unsupported' as const;
  constructor() {
    super('HarnessStorage channel bindings must be implemented by this storage adapter');
  }
}

export class HarnessStorageSessionRecordProjectionUnsupportedError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageSessionRecordProjectionUnsupportedError';
  readonly code = 'harness.storage.session_record_projection_unsupported' as const;
  constructor() {
    super('HarnessStorage session record projection must be implemented by this storage adapter');
  }
}

export class HarnessStorageSessionProjectionIncarnationError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageSessionProjectionIncarnationError';
  readonly code = 'harness.storage.session_record_projection_incarnation_invalid' as const;
  constructor(public readonly sessionId: string) {
    super(`Session "${sessionId}" has no valid durable projection incarnation`);
  }
}

export class HarnessStorageSessionProjectionIdentityError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageSessionProjectionIdentityError';
  readonly code = 'harness.storage.session_record_projection_identity_invalid' as const;
  constructor(
    public readonly sessionId: string,
    public readonly field: 'resourceId' | 'threadId',
  ) {
    super(`Session "${sessionId}" cannot change its projection ${field} within one incarnation`);
  }
}

export class HarnessStorageSessionProjectionClaimConflictError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageSessionProjectionClaimConflictError';
  readonly code = 'harness.storage.session_record_projection_claim_conflict' as const;
  constructor(
    public readonly operationId: string,
    public readonly claimId?: string,
  ) {
    super(`Session projection intent "${operationId}" is not held by claim "${claimId ?? '<none>'}"`);
  }
}

export class HarnessStorageSessionProjectionBackpressureError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageSessionProjectionBackpressureError';
  readonly code = 'harness.storage.session_record_projection_backpressure' as const;
  constructor(
    public readonly pendingIntents: number,
    public readonly pendingBytes: number,
  ) {
    super('Session record projection queue is at its configured capacity');
  }
}

/**
 * Thrown when a write would leave two `active` bindings for the same platform
 * conversation tuple (§5.2h: active rows are unique at storage level). Create or
 * replace through `resolveChannelBinding`, which fences the prior active row.
 */
export class HarnessStorageChannelBindingConflictError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageChannelBindingConflictError';
  readonly code = 'harness.storage.channel_binding_conflict' as const;
  constructor(
    public readonly channelId: string,
    public readonly externalThreadId: string,
    public readonly heldBy: string,
  ) {
    super(
      `An active channel binding already exists for channel "${channelId}" thread "${externalThreadId}" (held by "${heldBy}")`,
    );
  }
}

export class HarnessStorageProviderCallbackBindingUnsupportedError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageProviderCallbackBindingUnsupportedError';
  readonly code = 'harness.storage.provider_callback_binding_unsupported' as const;
  constructor() {
    super('HarnessStorage provider callback bindings must be implemented by this storage adapter');
  }
}

export class HarnessStorageProviderCallbackBindingTransitionError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageProviderCallbackBindingTransitionError';
  readonly code = 'harness.storage.provider_callback_binding_transition_invalid' as const;
  constructor(
    public readonly bindingId: string,
    public readonly fromStatus: HarnessProviderCallbackBinding['status'] | undefined,
    public readonly toStatus: HarnessProviderCallbackBinding['status'],
    reason: string,
  ) {
    super(
      `Provider callback binding "${bindingId}" cannot transition from "${fromStatus ?? '<missing>'}" to "${toStatus}": ${reason}`,
    );
  }
}

export class HarnessStorageChannelInboxClaimConflictError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageChannelInboxClaimConflictError';
  readonly code = 'harness.storage.channel_inbox_claim_conflict' as const;
  constructor(
    public readonly inboxItemId: string,
    public readonly claimId?: string,
  ) {
    super(`Channel inbox item "${inboxItemId}" is not held by claim "${claimId ?? '<none>'}"`);
  }
}

export class HarnessStorageChannelInboxTransitionError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageChannelInboxTransitionError';
  readonly code = 'harness.storage.channel_inbox_transition_invalid' as const;
  constructor(
    public readonly inboxItemId: string,
    public readonly fromStatus: ChannelInboxItem['status'] | undefined,
    public readonly toStatus: ChannelInboxItem['status'],
    reason: string,
  ) {
    super(
      `Channel inbox item "${inboxItemId}" cannot transition from "${fromStatus ?? '<missing>'}" to "${toStatus}": ${reason}`,
    );
  }
}

export class HarnessStorageChannelActionClaimConflictError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageChannelActionClaimConflictError';
  readonly code = 'harness.storage.channel_action_claim_conflict' as const;
  constructor(
    public readonly receiptId: string,
    public readonly claimId?: string,
  ) {
    super(`Channel action receipt "${receiptId}" is not held by claim "${claimId ?? '<none>'}"`);
  }
}

export class HarnessStorageChannelActionTokenConflictError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageChannelActionTokenConflictError';
  readonly code = 'harness.storage.channel_action_token_conflict' as const;
  constructor(
    public readonly actionTokenId: string,
    reason: string,
  ) {
    super(`Channel action token "${actionTokenId}" conflicts with stored token: ${reason}`);
  }
}

export class HarnessStorageChannelActionReceiptTransitionError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageChannelActionReceiptTransitionError';
  readonly code = 'harness.storage.channel_action_receipt_transition_invalid' as const;
  constructor(
    public readonly receiptId: string,
    public readonly fromStatus: ChannelActionReceipt['status'] | undefined,
    public readonly toStatus: ChannelActionReceipt['status'],
    reason: string,
  ) {
    super(
      `Channel action receipt "${receiptId}" cannot transition from "${fromStatus ?? '<missing>'}" to "${toStatus}": ${reason}`,
    );
  }
}

export class HarnessStorageChannelOutboxClaimConflictError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageChannelOutboxClaimConflictError';
  readonly code = 'harness.storage.channel_outbox_claim_conflict' as const;
  constructor(
    public readonly outboxItemId: string,
    public readonly claimId?: string,
  ) {
    super(`Channel outbox item "${outboxItemId}" is not held by claim "${claimId ?? '<none>'}"`);
  }
}

export class HarnessStorageChannelOutboxTransitionError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageChannelOutboxTransitionError';
  readonly code = 'harness.storage.channel_outbox_transition_invalid' as const;
  constructor(
    public readonly outboxItemId: string,
    public readonly fromStatus: ChannelOutboxItem['status'] | undefined,
    public readonly toStatus: ChannelOutboxItem['status'],
    reason: string,
  ) {
    super(
      `Channel outbox item "${outboxItemId}" cannot transition from "${fromStatus ?? '<missing>'}" to "${toStatus}": ${reason}`,
    );
  }
}

export class HarnessStorageWakeupClaimConflictError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageWakeupClaimConflictError';
  readonly code = 'harness.storage.wakeup_claim_conflict' as const;
  constructor(
    public readonly wakeupItemId: string,
    public readonly claimId?: string,
  ) {
    super(`Harness wakeup item "${wakeupItemId}" is not held by claim "${claimId ?? '<none>'}"`);
  }
}

export class HarnessStorageWakeupTransitionError extends HarnessStorageDomainError {
  readonly name = 'HarnessStorageWakeupTransitionError';
  readonly code = 'harness.storage.wakeup_transition_invalid' as const;
  constructor(
    public readonly wakeupItemId: string,
    public readonly fromStatus: HarnessWakeupItem['status'] | undefined,
    public readonly toStatus: HarnessWakeupItem['status'],
    reason: string,
  ) {
    super(
      `Harness wakeup item "${wakeupItemId}" cannot transition from "${fromStatus ?? '<missing>'}" to "${toStatus}": ${reason}`,
    );
  }
}

/**
 * Storage domain for the v1 Harness — see HARNESS_V1_SPEC.md §5.
 *
 * Owns four resource groups:
 *
 *   1. **Session records** — durable session state (mode, model, permissions,
 *      pending queue, pending approval/suspension/question/plan, goal,
 *      workspace state, custom user state). Persisted under an
 *      optimistic-CAS contract: every write supplies an `ifVersion` and the
 *      adapter bumps to `ifVersion + 1` on success.
 *
 *   2. **Session leases** — per-session ownership tokens that gate writes
 *      across multiple Harness instances pointing at the same store
 *      (HARNESS_V1_SPEC.md §5.8). Acquire-renew-release pattern with TTL.
 *
 *   3. **Attachment metadata** — index rows mapping `attachmentId` to
 *      `(ownerSessionId, name, mimeType, bytes, sha256, source)` and the
 *      underlying bytes. Adapters are free to delegate the bytes to a
 *      separate blob store (S3, R2, local disk) under the same interface.
 *
 *   4. **Thread delete fences** — short-lived thread-scoped ownership tokens
 *      that block active-session admission while `threads.delete(...)` proves
 *      storage ownership before deleting global MemoryStorage thread rows.
 *
 * Threads and messages are NOT in this domain — they live under
 * `MemoryStorage`. The harness layer composes the two.
 */
export abstract class HarnessStorage extends StorageDomain {
  protected readonly sessionRecordProjection: NormalizedHarnessSessionRecordProjectionConfig;

  get supportsAtomicDeleteSessions(): boolean {
    return this.deleteSessions !== HarnessStorage.prototype.deleteSessions;
  }

  get supportsSessionRecordProjection(): boolean {
    return false;
  }

  constructor(options: { sessionRecordProjection?: HarnessSessionRecordProjectionOption } = {}) {
    super({
      component: 'STORAGE',
      name: 'HARNESS',
    });
    this.sessionRecordProjection = normalizeHarnessSessionRecordProjectionConfig(options.sessionRecordProjection);
  }

  // -------------------------------------------------------------------------
  // Session records
  // -------------------------------------------------------------------------

  /**
   * Direct ID lookup. Returns the record regardless of `closedAt` — this is
   * the path that powers history APIs.
   *
   * Resource scoping is NOT enforced here; the harness layer cross-checks
   * `resourceId` against the returned record before surfacing it.
   */
  abstract loadSession(opts: { harnessName?: string; sessionId: string }): Promise<SessionRecord | null>;

  /**
   * Lookup by (thread, resource). Returns the **current owner** for the tuple,
   * including Closed and Closing records (HARNESS_V1_SPEC.md §5.2a/§5.3/§5.5):
   * Closed owners are reopen candidates, Closing owners fail new-work hydration
   * with `HarnessSessionClosingError`. Returns `null` only when no current
   * owner exists for the `(harnessName, resourceId, threadId)` pair — this is
   * what makes `harness.session({ threadId, resourceId })` reopen the same
   * session after close instead of minting a fresh active record. Deleted
   * records are removed and are never returned.
   *
   * Implementations reject new rows that would create a second active session
   * for the same `(harnessName, resourceId, threadId)` admission key.
   */
  abstract loadSessionByThread(opts: {
    harnessName?: string;
    threadId: string;
    resourceId: string;
  }): Promise<SessionRecord | null>;

  /**
   * List session summaries for a resource. Closed records are excluded by
   * default; pass `includeClosed: true` to surface them. `parentSessionId`
   * filters to direct children — adapters MUST push this filter to the
   * storage layer (no in-memory fan-out).
   */
  abstract listSessions(opts: ListSessionsInput): Promise<SessionSummary[]>;

  /**
   * List session summaries for an exact `(resourceId, threadId)` key. Closed
   * records are excluded by default; pass `includeClosed: true` to surface
   * closed historical owners. Adapters must push the thread filter to the
   * storage layer because this powers `threads.delete(...)` root discovery.
   * The base implementation fails closed so custom adapters do not silently
   * fall back to resource-wide scans.
   */
  async listSessionsByThread(_opts: ListSessionsByThreadInput): Promise<SessionSummary[]> {
    throw new Error('HarnessStorage.listSessionsByThread must be implemented by this storage adapter');
  }

  /**
   * List active sessions for a thread across all resources and, by default,
   * every harness namespace visible to this adapter. Pass `harnessName` only
   * when a caller explicitly needs a namespace-scoped view. Used before global
   * `MemoryStorage.deleteThread(...)` calls, where deleting by thread id could
   * otherwise remove messages for a live session in another resource or
   * harness namespace backed by the same Harness storage adapter. Adapters
   * that back `threads.delete(...)` must override this method; the base
   * implementation fails closed because returning incomplete ownership data
   * before a global memory-thread delete could cause data loss.
   */
  async listActiveSessionsByThread(_opts: ListActiveSessionsByThreadInput): Promise<SessionSummary[]> {
    throw new Error('HarnessStorage.listActiveSessionsByThread must be implemented by this storage adapter');
  }

  /**
   * Discover due pending interactions without hydrating every session. Results
   * are ordered by `(expiresAt, sessionId)` and keyset-paginated. The returned
   * generation is advisory: the expiry worker must compare it under the
   * session CAS so a response/new pending generation can win safely.
   */
  abstract listDuePendingInteractions(opts: ListDuePendingInteractionsInput): Promise<ListDuePendingInteractionsResult>;

  /**
   * Run a small critical section while new active-session admission for this
   * thread is fenced. Durable adapters persist the fence so another process
   * cannot create a session after the active-session guard and before the
   * global memory-thread delete. The base implementation fails closed because a
   * no-op fence is unsafe for `threads.delete(...)`.
   */
  async withThreadDeleteFence<T>(
    _opts: WithThreadDeleteFenceInput,
    fn: (fence: ThreadDeleteFenceLease) => Promise<T>,
  ): Promise<T> {
    void fn;
    throw new HarnessStorageThreadDeleteFenceUnsupportedError();
  }

  /**
   * Optimistic-CAS write of a session record.
   *
   * - For first insert, pass `ifVersion: 0`. Adapters create the row with
   *   `version: 1` and return `{ version: 1 }`.
   * - For updates, pass the version observed on read. Adapters update only
   *   when the row's current version matches and bump to `ifVersion + 1`.
   *
   * Throws `HarnessStorageVersionConflictError` on version mismatch.
   * Throws `HarnessStorageLeaseConflictError` when `ownerId` does not match
   * the row's current lease holder (and the lease has not expired).
   */
  abstract saveSession(record: SessionRecord, opts: SaveSessionOptions): Promise<SaveSessionResult>;

  /**
   * CAS write of a session record plus durable attachment reference rows in
   * one adapter operation. Used by queue admission so a racing attachment
   * delete either happens before the queued item exists, or observes the new
   * reference and fails. Implementations must also reject if any referenced
   * attachment row is missing. The session record must already exist.
   */
  abstract saveSessionWithAttachmentReferences(
    record: SessionRecord,
    opts: SaveSessionOptions,
    references: SaveAttachmentReferenceInput[],
  ): Promise<SaveSessionResult>;

  /**
   * Atomic active-session admission. Returns the existing active row for
   * `(harnessName, resourceId, threadId)` without overwriting it; otherwise
   * inserts `record`. When `record.parentSessionId` is present and no active
   * row already exists, adapters must also verify the parent exists in the
   * same harness/resource and is neither closing nor closed in the same atomic
   * admission boundary. A created row also receives the caller's initial lease.
   *
   * Throws `HarnessStorageParentSessionUnavailableError` from
   * `createOrLoadActiveSession` when parent verification fails.
   */
  abstract createOrLoadActiveSession(
    record: SessionRecord,
    opts: CreateOrLoadActiveSessionOptions,
  ): Promise<CreateOrLoadActiveSessionResult>;

  /**
   * Hard-delete of a single session record. Adapters do NOT implement cascade
   * themselves. No-op when the record does not exist. Optional
   * `DeleteSessionOptions` guard fields are CAS fences: if any provided guard
   * does not match the stored row, adapters reject without deleting the row.
   *
   * Implementations should also delete attachments owned by the session
   * (equivalent to `deleteAttachmentsForSession`) to keep the index clean.
   */
  abstract deleteSession(opts: DeleteSessionOptions): Promise<void>;

  /**
   * Hard-delete a collected session subtree under one guarded adapter boundary.
   * Adapters must either delete every still-existing guarded row or reject
   * without deleting any of them. The default preserves single-session legacy
   * adapter compatibility; adapters must override this for multi-session
   * all-or-nothing batch semantics.
   */
  async deleteSessions(opts: { sessions: DeleteSessionOptions[] }): Promise<void> {
    if (opts.sessions.length > 1) {
      throw new Error(
        'HarnessStorage.deleteSessions must be overridden by this storage adapter for atomic batch deletes',
      );
    }
    for (const session of opts.sessions) {
      await this.deleteSession(session);
    }
  }

  // -------------------------------------------------------------------------
  // Native session record projection
  // -------------------------------------------------------------------------

  async claimSessionRecordProjectionIntents(
    _input: ClaimSessionRecordProjectionIntentsInput,
  ): Promise<HarnessSessionRecordProjectionIntent[]> {
    throw new HarnessStorageSessionRecordProjectionUnsupportedError();
  }

  async renewSessionRecordProjectionClaim(
    _input: RenewSessionRecordProjectionClaimInput,
  ): Promise<{ claimExpiresAt: number; storageNow: number }> {
    throw new HarnessStorageSessionRecordProjectionUnsupportedError();
  }

  async ackSessionRecordProjection(_input: AckSessionRecordProjectionInput): Promise<AckSessionRecordProjectionResult> {
    throw new HarnessStorageSessionRecordProjectionUnsupportedError();
  }

  async failSessionRecordProjection(
    _input: FailSessionRecordProjectionInput,
  ): Promise<HarnessSessionRecordProjectionIntent> {
    throw new HarnessStorageSessionRecordProjectionUnsupportedError();
  }

  async getSessionRecordProjectionQueuePressure(
    _input: SessionRecordProjectionQueuePressureInput,
  ): Promise<SessionRecordProjectionQueuePressure> {
    throw new HarnessStorageSessionRecordProjectionUnsupportedError();
  }

  // -------------------------------------------------------------------------
  // Session leases (HARNESS_V1_SPEC.md §5.8)
  // -------------------------------------------------------------------------

  /**
   * Acquire the write lease for a session.
   *
   * Succeeds when:
   *   - the row has no `ownerId`, OR
   *   - the row's lease has expired (`leaseExpiresAt <= now`), OR
   *   - the row's `ownerId` already matches `opts.ownerId` (idempotent).
   *
   * Otherwise throws `HarnessStorageLeaseConflictError`. Callers that want
   * blocking or stealing semantics implement them above this primitive.
   *
   * Throws `HarnessStorageSessionNotFoundError` when the row does not exist.
   */
  abstract acquireSessionLease(opts: AcquireSessionLeaseInput): Promise<SessionLeaseResult>;

  /**
   * Renew an existing lease — bumps `leaseExpiresAt` to `now + ttlMs`.
   *
   * Throws `HarnessStorageLeaseConflictError` when the row's current
   * `ownerId` does not match `opts.ownerId`, or when the lease has already
   * expired (no implicit re-acquire — caller must use `acquire` for that).
   * Throws `HarnessStorageSessionNotFoundError` when the row does not exist.
   */
  abstract renewSessionLease(opts: RenewSessionLeaseInput): Promise<SessionLeaseResult>;

  /**
   * Renew the parent/root lease AND every active (non-closed) descendant lease
   * entry under it on a single storage-linearized cycle (§5.8). All descendants
   * are capped at the root's new `expiresAt`, committed in one pass so the call
   * never returns a parent-only partial success. It throws
   * `HarnessStorageSessionNotFoundError` when the root is missing and
   * `HarnessStorageLeaseConflictError` when the root is not held/expired by this
   * owner OR when an active descendant has been claimed by a DIFFERENT instance
   * (a split subtree) — in either case it renews nothing. A same-owner
   * descendant whose mirror lapsed is re-adopted to the capped expiry (that is
   * the §5.8 repair, not a fence). Closed/closing descendants hold no live lease
   * and are skipped.
   *
   * `renewedDescendantCount` reports how many descendant entries were extended.
   *
   * No safe base default exists: composing per-node `renewSessionLease` calls
   * would renew the root and descendants in SEPARATE writes, so a mid-walk
   * adapter failure could leave the root renewed while a descendant is not —
   * exactly the parent-only partial commit §5.8 forbids. Rather than ship that
   * trap, the base throws `HarnessStorageSubtreeLeaseRenewalUnsupportedError`;
   * every adapter MUST override with a single storage-linearized cycle (the
   * in-memory adapter does a synchronous validate-all-then-commit pass; SQL
   * adapters use one transactional recursive `UPDATE`).
   */
  async renewSessionLeaseSubtree(_opts: RenewSessionLeaseSubtreeInput): Promise<SubtreeSessionLeaseResult> {
    throw new HarnessStorageSubtreeLeaseRenewalUnsupportedError();
  }

  /**
   * Release the lease (clears `ownerId` and `leaseExpiresAt`). No-op when
   * `opts.ownerId` does not match the current owner — releasing a lease you
   * do not hold should not throw, since the common cause is "we noticed our
   * lease expired and another instance picked it up".
   *
   * Throws `HarnessStorageSessionNotFoundError` when the row does not exist.
   */
  abstract releaseSessionLease(opts: ReleaseSessionLeaseInput): Promise<void>;

  // -------------------------------------------------------------------------
  // Attachments
  // -------------------------------------------------------------------------

  /**
   * Persist an attachment's bytes and index row. Attachment IDs are immutable:
   * when the row already exists, adapters return the existing row's size and
   * digest without overwriting bytes or metadata.
   *
   * Adapters MAY delegate the bytes to a blob store but the index row
   * (filename, mime type, size, digest, source, owning session) must be
   * queryable through `getAttachmentRecord`; `loadAttachment` returns the
   * byte payload plus replay-validation metadata.
   */
  abstract saveAttachment(opts: SaveAttachmentInput): Promise<SaveAttachmentResult>;

  /**
   * Load an attachment by (sessionId, attachmentId). Returns null when the
   * row is missing.
   */
  abstract loadAttachment(opts: {
    harnessName?: string;
    sessionId: string;
    attachmentId: string;
  }): Promise<LoadedAttachment | null>;

  /**
   * Delete a single attachment. No-op when the row is missing.
   * Throws `HarnessStorageAttachmentInUseError` while references remain.
   */
  abstract deleteAttachment(opts: { harnessName?: string; sessionId: string; attachmentId: string }): Promise<void>;

  /**
   * Delete all attachments owned by a session. Called from `deleteSession`
   * implementations so the index does not leak rows when a session is torn
   * down. Referenced rows are skipped; force cleanup belongs to the lifecycle
   * delete lane.
   */
  abstract deleteAttachmentsForSession(opts: { harnessName?: string; sessionId: string }): Promise<void>;

  /**
   * Look up the index row only (without bytes). Useful for attachment
   * metadata listings (e.g. message rendering).
   */
  abstract getAttachmentRecord(opts: {
    harnessName?: string;
    sessionId: string;
    attachmentId: string;
  }): Promise<AttachmentRecord | null>;

  /**
   * Register durable references to attachment bytes. Source ids are scoped by
   * source: queued item id for `queued_item`, message id for
   * `message_history`, run id for `current_run`, and source-specific row ids
   * for channel/wakeup/outbox references.
   */
  abstract recordAttachmentReferences(references: SaveAttachmentReferenceInput[]): Promise<void>;

  abstract deleteAttachmentReferences(references: SaveAttachmentReferenceInput[]): Promise<void>;

  abstract listAttachmentReferences(opts: {
    harnessName?: string;
    sessionId: string;
    attachmentId: string;
  }): Promise<AttachmentReference[]>;

  // -------------------------------------------------------------------------
  // Admission/result evidence
  // -------------------------------------------------------------------------

  /**
   * Load the complete durable row, including created/updated timestamps used by
   * deadline-fenced recovery. Returning only `AgentSignalResultStatus` is not
   * sufficient: a conforming adapter must not make an old completion appear to
   * have settled before a delegation deadline.
   */
  abstract loadMessageResultEvidence(opts: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId: string;
    signalId: string;
  }): Promise<AgentSignalResultEvidence | OperationAdmissionTombstone | null>;

  abstract writeMessageResultEvidence(record: AgentSignalResultEvidence): Promise<WriteMessageResultEvidenceResult>;

  /**
   * Atomically compare-and-swap the durable execution owner for an admitted
   * signal. The base fails closed so older custom adapters remain source
   * compatible but cannot silently provide unfenced admitted dispatch.
   */
  async compareAndSwapSignalDispatch(
    _input: CompareAndSwapSignalDispatchInput,
  ): Promise<CompareAndSwapSignalDispatchResult> {
    throw new HarnessStorageSignalDispatchUnsupportedError();
  }

  /**
   * Atomically settle an admitted signal only while the caller still owns the
   * expected dispatch attempt. The durable winner is returned on a lost CAS.
   */
  async compareAndSwapSignalTerminal(
    _input: CompareAndSwapSignalTerminalInput,
  ): Promise<CompareAndSwapSignalTerminalResult> {
    throw new HarnessStorageSignalDispatchUnsupportedError();
  }

  abstract loadQueueResultEvidence(opts: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    queuedItemId: string;
  }): Promise<QueueAdmissionReceipt | OperationAdmissionTombstone | null>;

  abstract resolveOperationAdmissionEvidence(opts: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId?: string;
    kind: 'signal' | 'queue';
    admissionId: string;
    attemptedAdmissionHash: string;
  }): Promise<{
    status: 'none' | 'duplicate' | 'conflict';
    evidence?: OperationAdmissionEvidence;
    storedAdmissionHash?: string;
  }>;

  abstract writeOperationAdmissionTombstone(record: OperationAdmissionTombstone): Promise<void>;

  abstract compactOperationResultEvidence(opts: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    kind: 'signal' | 'queue';
    signalId?: string;
    queuedItemId?: string;
    now: number;
  }): Promise<OperationAdmissionTombstone | null>;

  abstract deleteOperationAdmissionTombstonesForSession(opts: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId?: string;
    signalId?: string;
  }): Promise<void>;

  // -------------------------------------------------------------------------
  // Session event replay
  // -------------------------------------------------------------------------

  async appendSessionEvent(_record: HarnessSessionEventRecord): Promise<void> {
    throw new HarnessStorageSessionEventReplayUnsupportedError();
  }

  async getSessionEventReplayState(_opts: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId: string;
  }): Promise<HarnessSessionEventReplayState | null> {
    throw new HarnessStorageSessionEventReplayUnsupportedError();
  }

  async listSessionEvents(_opts: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId: string;
    epoch: string;
    afterSequence: number;
    limit: number;
  }): Promise<HarnessSessionEventRecord[]> {
    throw new HarnessStorageSessionEventReplayUnsupportedError();
  }

  // -------------------------------------------------------------------------
  // Workspace action journal
  // -------------------------------------------------------------------------

  /**
   * Append one immutable workspace policy/action audit row.
   *
   * Implementations return `{ created: false }` without mutating when the
   * owning session is missing, the `(resourceId, threadId)` fence does not
   * match the session, or the same `(harnessName, sessionId, id)` was already
   * written. Existing rows are never updated; callers that need multi-phase
   * evidence should append a separate row per phase.
   */
  async appendWorkspaceActionJournalEntry(
    _record: WorkspaceActionJournalEntry,
  ): Promise<AppendWorkspaceActionJournalEntryResult> {
    throw new HarnessStorageWorkspaceActionJournalUnsupportedError();
  }

  async listWorkspaceActionJournalEntries(
    _opts: ListWorkspaceActionJournalInput,
  ): Promise<WorkspaceActionJournalEntry[]> {
    throw new HarnessStorageWorkspaceActionJournalUnsupportedError();
  }

  // -------------------------------------------------------------------------
  // Provider callback binding ledger
  // -------------------------------------------------------------------------

  async resolveProviderCallbackBinding(
    _record: HarnessProviderCallbackBinding,
    _opts?: { replaceBindingId?: string },
  ): Promise<ResolveProviderCallbackBindingResult> {
    throw new HarnessStorageProviderCallbackBindingUnsupportedError();
  }

  async loadProviderCallbackBindingBySelector(_opts: {
    providerId: string;
    selectorKind: ProviderCallbackSelectorKind;
    selectorValue: string;
  }): Promise<HarnessProviderCallbackBinding | null> {
    throw new HarnessStorageProviderCallbackBindingUnsupportedError();
  }

  async markProviderCallbackBindingStatus(_opts: {
    bindingId: string;
    status: Extract<HarnessProviderCallbackBinding['status'], 'active' | 'disabled' | 'undeliverable'>;
    updatedAt?: number;
    lastError?: HarnessProviderCallbackBinding['lastError'];
  }): Promise<HarnessProviderCallbackBinding> {
    throw new HarnessStorageProviderCallbackBindingUnsupportedError();
  }

  // -------------------------------------------------------------------------
  // Channel bindings (§5.1h / §14.1). Durable per-conversation binding rows.
  // Concrete throw-by-default so adapters that don't support channels inherit a
  // clean unsupported error; InMemoryHarness overrides with real implementations.
  // -------------------------------------------------------------------------

  async saveChannelBinding(_record: ChannelBinding): Promise<void> {
    throw new HarnessStorageChannelBindingUnsupportedError();
  }

  /**
   * §14.1 forward-only activity-marker advance. Atomically merges the named
   * binding's `lastInboundAt`/`updatedAt` up to `max(stored, at)` against the
   * authoritative current row and returns the merged binding (or null if the row
   * no longer exists). Unlike a caller-side read-modify-write through
   * `saveChannelBinding`, this can never regress the marker under concurrent or
   * out-of-order same-binding ingress; adapters back it with a nullable-safe
   * conditional update, e.g. `GREATEST(COALESCE(last_inbound_at, 0), $at)`.
   */
  async touchChannelBindingInbound(_opts: {
    harnessName?: string;
    bindingId: string;
    at: number;
  }): Promise<ChannelBinding | null> {
    throw new HarnessStorageChannelBindingUnsupportedError();
  }

  async loadChannelBinding(_opts: { bindingId: string }): Promise<ChannelBinding | null> {
    throw new HarnessStorageChannelBindingUnsupportedError();
  }

  async loadChannelBindingByExternal(_opts: {
    harnessName: string;
    channelId: string;
    platform: string;
    externalTenantId?: string;
    externalChannelId?: string;
    externalThreadId: string;
  }): Promise<ChannelBinding | null> {
    throw new HarnessStorageChannelBindingUnsupportedError();
  }

  /**
   * §14.1 atomic resolve: returns the existing active binding for the
   * candidate's platform-conversation tuple, or commits the candidate as a new
   * active binding. When `replaceBindingId` is set, the named prior binding is
   * marked `replaced` (with `replacedByBindingId`) and the candidate is committed
   * with an incremented generation — never two active owners for one tuple.
   */
  async resolveChannelBinding(_opts: {
    candidate: ChannelBinding;
    replaceBindingId?: string;
  }): Promise<ResolveChannelBindingResult> {
    throw new HarnessStorageChannelBindingUnsupportedError();
  }

  async listChannelBindingsForSession(_opts: { sessionId: string }): Promise<ChannelBinding[]> {
    throw new HarnessStorageChannelBindingUnsupportedError();
  }

  async listActiveChannelBindingsForScope(_opts: {
    harnessName: string;
    channelId?: string;
    limit: number;
    cursor?: string;
  }): Promise<ListActiveChannelBindingsResult> {
    throw new HarnessStorageChannelBindingUnsupportedError();
  }

  async deleteChannelBinding(_opts: { bindingId: string }): Promise<void> {
    throw new HarnessStorageChannelBindingUnsupportedError();
  }

  // -------------------------------------------------------------------------
  // Channel inbox ledger
  // -------------------------------------------------------------------------

  abstract saveChannelInboxItem(record: ChannelInboxItem): Promise<void>;

  /**
   * Atomic insert-or-load for provider callback retries. The unique
   * idempotency identity is `(harnessName, channelId, idempotencyKey)`;
   * `payloadHash` is the adapter-normalized content/files/context hash used
   * to distinguish exact provider retries from same-key payload conflicts.
   * `initialClaim` may claim a newly created row or an unclaimed/expired
   * existing row, but it must not steal an unexpired active claim.
   */
  abstract createOrLoadChannelInboxItem(
    record: ChannelInboxItem,
    opts?: { initialClaim?: ChannelInboxInitialClaim },
  ): Promise<CreateOrLoadChannelInboxItemResult>;

  abstract loadChannelInboxItemByIdempotencyKey(opts: {
    harnessName: string;
    channelId: string;
    idempotencyKey: string;
  }): Promise<ChannelInboxItem | null>;

  abstract claimChannelInboxItems(opts: {
    harnessName: string;
    channelId?: string;
    statuses: Array<'received' | 'admitted' | 'failed'>;
    claimId: string;
    limit: number;
    now: number;
    claimTtlMs: number;
  }): Promise<ChannelInboxItem[]>;

  abstract renewChannelInboxClaim(opts: {
    inboxItemId: string;
    claimId: string;
    now: number;
    claimTtlMs: number;
  }): Promise<{ claimExpiresAt: number; storageNow: number }>;

  abstract updateChannelInboxItem(record: ChannelInboxItem, opts: { claimId: string }): Promise<void>;

  // -------------------------------------------------------------------------
  // Channel action token and receipt ledger
  // -------------------------------------------------------------------------

  abstract createOrLoadChannelActionToken(record: ChannelActionToken): Promise<CreateOrLoadChannelActionTokenResult>;

  abstract loadChannelActionTokenById(opts: {
    harnessName: string;
    channelId: string;
    actionTokenId: string;
  }): Promise<ChannelActionToken | null>;

  abstract loadChannelActionTokenByTransportHash(opts: {
    harnessName: string;
    channelId: string;
    transportHash: string;
  }): Promise<ChannelActionToken | null>;

  abstract loadChannelActionTokenForPendingItem(opts: {
    harnessName: string;
    channelId: string;
    bindingId: string;
    bindingGeneration: number;
    owningSessionId: string;
    itemId: string;
    kind: ChannelActionToken['kind'];
    runId: string;
    pendingRequestedAt: number;
    metadataHash: string;
  }): Promise<ChannelActionToken | null>;

  abstract revokeChannelActionToken(opts: {
    harnessName: string;
    channelId: string;
    actionTokenId: string;
    revokedAt?: number;
    revokedReason?: ChannelActionToken['revokedReason'];
  }): Promise<ChannelActionToken>;

  abstract saveChannelActionReceipt(record: ChannelActionReceipt): Promise<void>;

  abstract createOrLoadChannelActionReceipt(
    record: ChannelActionReceipt,
    opts?: { initialClaim?: ChannelActionInitialClaim },
  ): Promise<CreateOrLoadChannelActionReceiptResult>;

  abstract loadChannelActionReceiptByActionId(opts: {
    harnessName: string;
    channelId: string;
    actionId: string;
  }): Promise<ChannelActionReceipt | null>;

  abstract loadChannelActionReceiptByTokenId(opts: {
    harnessName: string;
    channelId: string;
    actionTokenId: string;
  }): Promise<ChannelActionReceipt | null>;

  abstract claimChannelActionReceipts(opts: {
    harnessName: string;
    channelId?: string;
    statuses: Array<'received' | 'accepted' | 'failed'>;
    claimId: string;
    limit: number;
    now: number;
    claimTtlMs: number;
  }): Promise<ChannelActionReceipt[]>;

  abstract renewChannelActionReceiptClaim(opts: {
    receiptId: string;
    claimId: string;
    now: number;
    claimTtlMs: number;
  }): Promise<{ claimExpiresAt: number; storageNow: number }>;

  abstract updateChannelActionReceipt(record: ChannelActionReceipt, opts: { claimId: string }): Promise<void>;

  // -------------------------------------------------------------------------
  // Channel outbox ledger
  // -------------------------------------------------------------------------

  /**
   * Atomic enqueue-or-load for provider-visible outbound effects. The unique
   * idempotency identity is `(harnessName, bindingId, idempotencyKey)`.
   * Exact duplicates must keep the first row; same-key rows with different
   * payload hash, operation identity, or delivery semantics return
   * `conflict: true` before any provider-visible side effect can run.
   */
  abstract enqueueChannelOutbox(record: ChannelOutboxItem): Promise<EnqueueChannelOutboxResult>;

  /**
   * Claims due pending/failed/expired-claimed rows for dispatch. Implementors
   * must enforce per-binding head-of-line ordering: a later non-terminal row
   * for one binding must not be claimed while an earlier non-terminal row for
   * the same binding remains unsettled.
   */
  abstract claimChannelOutbox(opts: {
    harnessName: string;
    channelId?: string;
    claimId: string;
    limit: number;
    now: number;
    claimTtlMs: number;
  }): Promise<ChannelOutboxItem[]>;

  abstract renewChannelOutboxClaim(opts: {
    outboxItemId: string;
    claimId: string;
    now: number;
    claimTtlMs: number;
  }): Promise<{ claimExpiresAt: number; storageNow: number }>;

  abstract markChannelOutboxSent(opts: {
    outboxItemId: string;
    claimId: string;
    sentAt?: number;
    providerMessageId?: string;
    providerReceipt?: ChannelProviderDeliveryReceipt;
  }): Promise<void>;

  abstract markChannelOutboxFailed(opts: {
    outboxItemId: string;
    claimId: string;
    retryAt?: number;
    dead?: boolean;
    error: { code: HarnessRowErrorCode; message: string; retryable?: boolean };
  }): Promise<void>;

  /**
   * Read-only session-scoped channel ledger diagnostics. Implementations must
   * push `resourceId` and `sessionIds` filters to storage and must not mutate,
   * claim, dispatch, retry, or reconcile rows.
   */
  async listChannelDiagnosticsRows(_opts: ListChannelDiagnosticsInput): Promise<ChannelDiagnosticsRows> {
    throw new HarnessStorageChannelDiagnosticsUnsupportedError();
  }

  // -------------------------------------------------------------------------
  // Wakeup ledger
  // -------------------------------------------------------------------------

  abstract createOrLoadHarnessWakeupItem(
    record: HarnessWakeupItem,
    opts?: { initialClaim?: HarnessWakeupInitialClaim },
  ): Promise<CreateOrLoadHarnessWakeupItemResult>;

  abstract loadHarnessWakeupItemByIdempotencyKey(opts: {
    harnessName: string;
    idempotencyKey: string;
  }): Promise<HarnessWakeupItem | null>;

  abstract loadHarnessWakeupItemBySourceFire(opts: {
    harnessName: string;
    source: HarnessWakeupItem['source'];
    sourceId: string;
    fireId: string;
  }): Promise<HarnessWakeupItem | null>;

  abstract claimHarnessWakeupItems(opts: {
    harnessName: string;
    source?: HarnessWakeupItem['source'];
    statuses: HarnessWakeupClaimStatus[];
    claimId: string;
    limit: number;
    now: number;
    claimTtlMs: number;
  }): Promise<HarnessWakeupItem[]>;

  abstract renewHarnessWakeupClaim(opts: {
    wakeupItemId: string;
    claimId: string;
    now: number;
    claimTtlMs: number;
  }): Promise<{ claimExpiresAt: number; storageNow: number }>;

  abstract updateHarnessWakeupItem(record: HarnessWakeupItem, opts: { claimId: string }): Promise<void>;

  // -------------------------------------------------------------------------
  // Plan tasks (HARNESS_V1_SPEC.md §5.1k / §4.8f)
  //
  // The durable, arbitrary-depth, model-authored agent task/todo TREE — distinct
  // from the runtime work-unit `HarnessTask`. All mutators are session-owner
  // fenced on `{ harnessName, sessionId, ownerId, ifSessionVersion }`: the
  // adapter verifies the owning `SessionRecord` still has `ownerId` holding an
  // unexpired lease (else `HarnessStorageLeaseConflictError`) and a `version`
  // matching `ifSessionVersion` (else `HarnessStorageVersionConflictError`)
  // before any row changes. Status ROLLUP, `blockedBy` cycle-prevention, the
  // plan tool (§6.4), and the `plan_task_*` event (§10.3) are DEFERRED to
  // TM-3 / TM-4 / TM-5; this layer persists `blockedBy` as data only.
  //
  // Concrete throw-by-default so adapters that do not yet support plan tasks
  // inherit a clean unsupported error; the in-memory / PG / LibSQL adapters
  // override with real implementations.
  // -------------------------------------------------------------------------

  /**
   * Insert one plan-task node under the session-owner fence. When the node's
   * `idempotencyKey` matches an existing task in the same session, the existing
   * row is returned unchanged (idempotent retry). Returns the stored row.
   */
  async createPlanTask(_opts: CreatePlanTaskInput): Promise<HarnessPlanTask> {
    throw new HarnessStoragePlanTaskUnsupportedError();
  }

  /**
   * Partial field write of a plan task by `taskId`, guarded by per-row OCC
   * (`ifVersion`) inside the session-owner fence. Throws
   * `HarnessStoragePlanTaskNotFoundError` when the row is missing and
   * `HarnessStoragePlanTaskVersionConflictError` on per-row version mismatch.
   */
  async updatePlanTask(_opts: UpdatePlanTaskInput): Promise<UpdatePlanTaskResult> {
    throw new HarnessStoragePlanTaskUnsupportedError();
  }

  /**
   * Cascade-delete a task and ALL its descendants (walked by `parentTaskId` via
   * a recursive CTE / BFS) under the session-owner fence — never reparent to
   * root. The walk defensively guards cycles (visited set / `UNION`). No-op
   * (deletedCount 0) when the root task does not exist.
   */
  async deletePlanTaskSubtree(_opts: DeletePlanTaskSubtreeInput): Promise<DeletePlanTaskSubtreeResult> {
    throw new HarnessStoragePlanTaskUnsupportedError();
  }

  /**
   * Transaction-shaped multi-row mutation (create/update/deleteSubtree ops) for
   * decompose/reparent (TM-3 / TM-4). All ops apply under one adapter boundary
   * or none do. Fenced on the session owner.
   */
  async mutatePlanTasksForSession(_opts: MutatePlanTasksForSessionInput): Promise<void> {
    throw new HarnessStoragePlanTaskUnsupportedError();
  }

  /**
   * List plan tasks for a session (harnessName+sessionId scoped), paginated by
   * `limit`/`cursor` and ordered by `(parentTaskId, order)`. Read-only — does
   * not require the lease.
   */
  async listPlanTasks(_opts: ListPlanTasksInput): Promise<ListPlanTasksResult> {
    throw new HarnessStoragePlanTaskUnsupportedError();
  }

  /**
   * Focused bounded read: the next-N nodes of the subtree under `rootTaskId`
   * (or session roots when omitted), bounded by `depth` and optionally filtered
   * by `status`. The anti-forgetting "re-orient" read. Read-only.
   */
  async loadPlanTaskSubtree(_opts: LoadPlanTaskSubtreeInput): Promise<LoadPlanTaskSubtreeResult> {
    throw new HarnessStoragePlanTaskUnsupportedError();
  }

  /**
   * Cheap exact aggregate over the session's plan tasks for the bounded
   * display-state summary (§5.1k / TM-5): `total`, per-status counts, and the
   * root count — computed by `COUNT(*) GROUP BY status` (plus a roots count),
   * NOT by loading rows. Keeps the display summary EXACT even when the tree is
   * larger than any single read page. Read-only — does not require the lease.
   */
  async countPlanTasksByStatus(_opts: CountPlanTasksByStatusInput): Promise<PlanTaskCountSummary> {
    throw new HarnessStoragePlanTaskUnsupportedError();
  }

  // -------------------------------------------------------------------------
  // Run summaries (span-summary O1/O2). Durable per-run HISTORY — one row per
  // completed run, written once (first terminal wins). Distinct from the
  // single-run `HarnessRunOperationalState` recovery lane. Read-only listing
  // does not require the lease.
  // -------------------------------------------------------------------------

  /**
   * Write one run summary. IDEMPOTENT: the first terminal for a `runId` wins;
   * a later write for the same `(harnessName, runId)` is a no-op (so duplicate
   * terminal paths and cross-instance retries cannot clobber or duplicate the
   * row). Returns the stored summary (the existing one on a no-op).
   */
  async saveRunSummary(_opts: SaveRunSummaryInput): Promise<HarnessRunSummary> {
    throw new HarnessStorageRunSummaryUnsupportedError();
  }

  /** Load one run summary by `runId`, or `null` when absent. Read-only. */
  async loadRunSummary(_opts: LoadRunSummaryInput): Promise<HarnessRunSummary | null> {
    throw new HarnessStorageRunSummaryUnsupportedError();
  }

  /**
   * List a session's completed-run summaries, newest first (by `completedAt`,
   * ties broken by `runId`), keyset-paginated via `beforeCompletedAt`.
   * Read-only.
   */
  async listRunSummaries(_opts: ListRunSummariesInput): Promise<ListRunSummariesResult> {
    throw new HarnessStorageRunSummaryUnsupportedError();
  }

  // -------------------------------------------------------------------------
  // Test-only
  // -------------------------------------------------------------------------

  /**
   * Drop all session records, leases, and attachments held by this domain.
   * Required by the `StorageDomain` contract; intended for tests only.
   */
  abstract dangerouslyClearAll(): Promise<void>;
}
