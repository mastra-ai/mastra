/**
 * Harness v1 — public entry point.
 *
 * Exported as `@mastra/core/harness/v1`. See HARNESS_V1_SPEC.md.
 *
 * Upstream's deprecated `@mastra/core/harness` entry aliases the canonical
 * AgentController API. The fork's durable Harness v1 runtime is intentionally
 * available only from this explicit subpath.
 */

export { Harness, createHarnessOperatorThreadController } from './harness';
export type { HarnessOperatorThreadController } from './harness';
export { Session } from './session';
export type { SessionLifecycleState, SessionDisplayState } from './session';
export { toHarnessDisplayStateSnapshotV1 } from './display-state';
export type {
  HarnessDisplayActiveSubagentSnapshotV1,
  HarnessDisplayActiveToolSnapshotV1,
  HarnessDisplayJsonValue,
  HarnessDisplayPendingSnapshotV1,
  HarnessDisplayStateSnapshotV1,
  HarnessDisplayToolInputBufferSnapshotV1,
} from './display-state';

export type {
  AgentEndEvent,
  AgentStartEvent,
  CustomEvent as HarnessCustomEvent,
  GoalClearedEvent,
  GoalDoneEvent,
  GoalJudgedEvent,
  GoalPausedEvent,
  GoalResumedEvent,
  GoalSetEvent,
  HarnessEvent,
  HarnessEventBase,
  HarnessEventListener,
  HarnessEventUnsubscribe,
  ModeChangedEvent,
  ModelChangedEvent,
  PermissionGrantedEvent,
  PermissionPolicyChangedEvent,
  PermissionRevokedEvent,
  ToolApprovalRequiredEvent,
  ToolSuspensionRequiredEvent,
  QuestionPendingEvent,
  PlanApprovalRequiredEvent,
  SessionClosedEvent,
  SessionClosingEvent,
  AttachmentUploadedEvent,
  AttachmentDeletedEvent,
  StorageErrorEvent,
  SessionCreatedEvent,
  SessionEvictedEvent,
  SessionHydratedEvent,
  HarnessShutdownEvent,
  StateChangedEvent,
  TurnErrorEvent,
  TokenUsageChangedEvent,
  TextDeltaEvent,
  ReasoningDeltaEvent,
  ToolEndEvent,
  ToolStartEvent,
} from './events';

export { HARNESS_EVENT_ID_PREFIX, formatHarnessEventId, parseHarnessEventId } from './events';
export {
  parseHarnessSubagentOutcomeReport,
  parseHarnessSubagentTerminalResult,
  parseHarnessTerminalToolResultArtifacts,
  parseHarnessTerminalToolResultText,
  projectHarnessSubagentOutcomeReceipts,
  verifyHarnessSubagentOutcomeReport,
  verifyHarnessSubagentTerminalCompletion,
} from './terminal-subagent-result';
export { getHarnessWorkspaceActionPathInput, isHarnessWorkspaceFileMutationTool } from './workspace-actions';

export {
  HarnessAbortedError,
  type HarnessAbortReason,
  HarnessAttachmentInUseError,
  HarnessAttachmentUnavailableError,
  HarnessBusyError,
  HarnessConfigError,
  HarnessAdmissionConflictError,
  HarnessInboxItemNotFoundError,
  HarnessInboxResponseConflictError,
  HarnessLiveSessionLimitError,
  HarnessOutputGenerationError,
  type HarnessOutputGenerationReason,
  HarnessPendingInteractionExpiredError,
  HarnessQueueItemExpiredError,
  HarnessQueueFullDroppedError,
  HarnessQueueFullError,
  HarnessQueuedTurnDeferredError,
  HarnessRuntimeDriftError,
  HarnessSessionCancelledError,
  HarnessSessionClosedError,
  HarnessSessionClosingError,
  HarnessSessionConflictError,
  HarnessSessionCorruptError,
  HarnessSessionDeleteBlockedError,
  type HarnessSessionDeleteBlocker,
  HarnessSessionDeletedError,
  HarnessSessionLockedError,
  HarnessSessionNotFoundError,
  HarnessSkillNotFoundError,
  HarnessStateConflictError,
  HarnessStateSerializationError,
  HarnessSkillArgsValidationError,
  HarnessStorageError,
  type HarnessStorageOperation,
  type HarnessStorageSubject,
  HarnessSubagentConcurrencyLimitError,
  HarnessSubagentDepthExceededError,
  HarnessThreadNotFoundError,
  HarnessValidationError,
  HarnessResourceWorkspaceInUseError,
  HarnessWorkspaceLostError,
  HarnessWorkspaceProviderMismatchError,
  HarnessWorkspaceProvisioningError,
} from './errors';

export { nonDurableProvider } from './workspace-provider';
export type { WorkspaceOwnershipKind, WorkspaceProvider, WorkspaceProviderContext } from './workspace-provider';
export { evaluateWorkspacePolicy, resolveWorkspacePath } from './workspace-policy';
export type {
  WorkspaceCommandPolicyAction,
  WorkspaceFileOperation,
  WorkspaceFilePolicyAction,
  WorkspaceMcpPolicyAction,
  WorkspaceNetworkPolicyAction,
  WorkspacePolicy,
  WorkspacePolicyAction,
  WorkspacePolicyActionKind,
  WorkspacePolicyEvaluation,
  WorkspacePolicyMatchedRule,
  WorkspacePolicyRule,
  WorkspaceResolvedPath,
  WorkspaceRootDescriptor,
} from './workspace-policy';
export { createWorkspaceRestorePlan, workspaceRestoreEntryMatchesScope } from './workspace-restore';
export type {
  CreateWorkspaceRestorePlanOptions,
  WorkspaceRestoreAffectedPath,
  WorkspaceRestoreConflict,
  WorkspaceRestoreConflictStatus,
  WorkspaceRestorePlan,
  WorkspaceRestorePlanStep,
  WorkspaceRestoreScope,
  WorkspaceRestoreStepKind,
  WorkspaceRestoreStepStatus,
} from './workspace-restore';

export type {
  HarnessAdmissionEvidence,
  HarnessEvidence,
  HarnessEvidenceKind,
  HarnessRun,
  HarnessRunFinishReason,
  HarnessTask,
  HarnessTaskIndexEntry,
  HarnessTaskOrigin,
  HarnessTaskStatus,
  PendingInteraction,
  TaskIdFieldMapping,
} from './contracts';

export type {
  HarnessMessage,
  HarnessMessageContent,
  HarnessMessageContent as HarnessMessageContentPart,
} from './types';

/**
 * Goal-loop primitive types (§4.7). `GoalState` lives in `SessionRecord.goal`
 * and is returned by `Session.getGoal()` / `setGoal(...)`. `GoalJudgeDecision`
 * captures one judge verdict.
 */
export type { GoalJudgeDecision, GoalState } from '../../storage/domains/harness';

export type {
  AttachmentDeleteOptions,
  AttachmentRef,
  AttachmentUploadOptions,
  ElementAttachmentUploadOptions,
  FileAttachmentUploadOptions,
  ChannelActionEnvelope,
  ChannelActorContext,
  ChannelConversationKind,
  ChannelIngressEnvelope,
  ChannelIngressTrigger,
  GoalOptions,
  HarnessActionCatalogEntry,
  HarnessActionCatalogEntryStatus,
  HarnessActionCatalogListOptions,
  HarnessActionCatalogMcpServerSource,
  HarnessActionCatalogMcpToolSource,
  HarnessActionCatalogSkillSource,
  HarnessActionCatalogSource,
  HarnessActionCatalogSourceKind,
  HarnessActionCatalogUnavailableReason,
  HarnessChannelAdapter,
  HarnessChannelBinding,
  HarnessChannelConfig,
  HarnessChannelDiagnostics,
  HarnessChannelDiagnosticsOptions,
  HarnessChannelDeliveryContext,
  HarnessChannelDiagnosticError,
  HarnessChannelDiagnosticLease,
  HarnessChannelActionReceiptDiagnostic,
  HarnessChannelActionTokenDiagnostic,
  HarnessChannelInboxDiagnostic,
  HarnessChannelOutboxDiagnostic,
  ChannelOutboxDispatchOptions,
  ChannelOutboxDispatchResult,
  HarnessChannelInboundResult,
  HarnessChannelRouteContext,
  HarnessChannelTransportRequest,
  HarnessConfig,
  HarnessRequestContext,
  HarnessMcpServerDescriptor,
  HarnessMcpToolDescriptor,
  HarnessMode,
  HarnessQueueBackpressurePolicy,
  HarnessSkill,
  HarnessSkillActionMetadata,
  HarnessSkillActionPermissionHints,
  HarnessSkillActionShortcut,
  InboxResponseOptions,
  InboxResponseResult,
  PrimitiveAttachmentUploadOptions,
  UseSkillOptions,
  HarnessWorkspaceConfig,
  ListMessagesOptions,
  AgentStream,
  MessageAdmissionResult,
  MessageOptionsStream,
  PermissionPolicy,
  QueueAdmissionResult,
  RegisterSandboxAccessParams,
  SessionDeleteOptions,
  SessionListOptions,
  SessionLoadByIdOptions,
  SessionLoadByThreadOptions,
  SessionRecord,
  SessionResolveById,
  SessionResolveByIdScoped,
  SessionResolveByThread,
  SessionResolveOptions,
  SetStateOptions,
  ShutdownOptions,
  SubagentDefinition,
  ThreadCloneOptions,
  ThreadCreateOptions,
  ThreadDeleteOptions,
  ThreadGetOptions,
  ThreadListOptions,
  ThreadListResult,
  ThreadRecord,
  ThreadRenameOptions,
  ToolCategory,
} from './types';

export type {
  AttachmentObjectPointer,
  AttachmentRendererDescriptor,
  ChannelDeliverySemantics,
  ChannelOutboxEnqueueOptions,
  ChannelOutboxItem,
  ChannelOutboxKind,
  ChannelOutboxOperationKind,
  ChannelOutboxSource,
  ChannelOutboxTarget,
  ChannelProviderDeliveryReceipt,
  HarnessAttachmentKind,
  HarnessPrimitiveType,
  InboxResponseReceipt,
  JsonValue,
  PermissionRules,
  SessionGrants,
} from '../../storage/domains/harness';
