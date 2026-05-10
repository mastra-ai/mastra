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
  TextDeltaEvent,
  ThreadClonedEvent,
  ThreadCreatedEvent,
  ThreadDeletedEvent,
  ThreadRenamedEvent,
  ToolEndEvent,
  ToolStartEvent,
} from './events';

export {
  HarnessConfigError,
  HarnessSessionClosedError,
  HarnessSessionLockedError,
  HarnessSessionNotFoundError,
  HarnessStorageError,
  HarnessThreadNotFoundError,
} from './errors';

export type {
  AttachmentDeleteOptions,
  AttachmentRef,
  AttachmentUploadOptions,
  HarnessConfig,
  HarnessMode,
  SessionListOptions,
  SessionLoadByIdOptions,
  SessionRecord,
  SessionResolveByResource,
  SessionResolveById,
  SessionResolveByIdScoped,
  SessionResolveByThread,
  SessionResolveOptions,
  ShutdownOptions,
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
