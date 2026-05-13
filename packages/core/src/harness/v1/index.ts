/**
 * Harness v1 — public entry point.
 *
 * Exported as `@mastra/core/harness/v1`. See HARNESS_V1_SPEC.md.
 *
 * The legacy Harness lives at `@mastra/core/harness` and remains the
 * default through v1.0. See §11 for the migration story.
 */

export { Harness } from './harness';
export { Session } from './session';
export type { SessionLifecycleState, SessionDisplayState } from './session';

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
  SessionClosedEvent,
  SessionCreatedEvent,
  SessionEvictedEvent,
  StateChangedEvent,
  SuspensionRequiredEvent,
  SuspensionResolvedEvent,
  ShellOutputEvent,
  ThreadClonedEvent,
  ThreadCreatedEvent,
  ThreadDeletedEvent,
  ThreadRenamedEvent,
  ToolEndEvent,
  ToolStartEvent,
  ToolUpdateEvent,
  WorkspaceErrorEvent,
  WorkspaceStatusChangedEvent,
} from './events';

export {
  HarnessConfigError,
  HarnessQueueFullError,
  HarnessSessionClosedError,
  HarnessSessionLockedError,
  HarnessSessionNotFoundError,
  HarnessSkillNotFoundError,
  HarnessStorageError,
  HarnessSubagentDepthExceededError,
  HarnessThreadNotFoundError,
  HarnessValidationError,
  HarnessWorkspaceInUseError,
  HarnessWorkspaceLostError,
  HarnessWorkspaceProviderMismatchError,
  HarnessWorkspaceProvisioningError,
} from './errors';

export { nonDurableProvider } from './workspace-provider';
export type { WorkspaceOwnershipKind, WorkspaceProvider, WorkspaceProviderContext } from './workspace-provider';

/**
 * `HarnessMessage` and `HarnessMessageContent` are stable cross-version
 * interfaces (spec §11.1). They are re-exported from v1 and back the same
 * underlying definitions used by the legacy `Harness`, so renderers can
 * import from either entry point and consume the same shape.
 */
export type { HarnessMessage, HarnessMessageContent } from '../types';

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
  GoalOptions,
  HarnessConfig,
  HarnessMode,
  HarnessSkill,
  HarnessWorkspaceConfig,
  ListMessagesOptions,
  PermissionPolicy,
  SessionListOptions,
  SessionLoadByIdOptions,
  SessionRecord,
  SessionResolveByResource,
  SessionResolveById,
  SessionResolveByIdScoped,
  SessionResolveByThread,
  SessionResolveOptions,
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
  ThreadSelectOrCreateOptions,
  ToolCategory,
} from './types';

export type { PermissionRules, SessionGrants } from '../../storage/domains/harness';
