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
export type { SessionLifecycleState } from './session';

export {
  HarnessConfigError,
  HarnessSessionClosedError,
  HarnessSessionLockedError,
  HarnessSessionNotFoundError,
  HarnessStorageError,
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
  ThreadDeleteOptions,
} from './types';
