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
  HarnessEvent,
  HarnessEventBase,
  HarnessEventListener,
  HarnessEventUnsubscribe,
  ModeChangedEvent,
  ModelChangedEvent,
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
} from './events';

export {
  HarnessConfigError,
  HarnessQueueFullError,
  HarnessSessionClosedError,
  HarnessSessionLockedError,
  HarnessSessionNotFoundError,
  HarnessStorageError,
  HarnessSubagentDepthExceededError,
  HarnessThreadNotFoundError,
  HarnessValidationError,
} from './errors';

/**
 * `HarnessMessage` and `HarnessMessageContent` are stable cross-version
 * interfaces (spec §11.1). They are re-exported from v1 and back the same
 * underlying definitions used by the legacy `Harness`, so renderers can
 * import from either entry point and consume the same shape.
 */
export type { HarnessMessage, HarnessMessageContent } from '../types';

export type {
  AttachmentDeleteOptions,
  AttachmentRef,
  AttachmentUploadOptions,
  HarnessConfig,
  HarnessMode,
  ListMessagesOptions,
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
} from './types';
