/**
 * Harness v1 — public entry point.
 *
 * Exported as `@mastra/core/harness/v1`. See HARNESS_V1_SPEC.md.
 *
 * The legacy Harness lives at `@mastra/core/harness` and remains the
 * default through v1.0. See §11 for the migration story.
 */

export { Harness } from './harness';

export type {
  AttachmentDeleteOptions,
  AttachmentRef,
  AttachmentUploadOptions,
  HarnessConfig,
  HarnessMode,
  Session,
  SessionListOptions,
  SessionLoadByIdOptions,
  SessionRecord,
  SessionResolveById,
  SessionResolveByIdScoped,
  SessionResolveByThread,
  SessionResolveOptions,
  ShutdownOptions,
  ThreadDeleteOptions,
} from './types';
