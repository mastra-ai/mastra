export {
  MASTRA_AUTH_TOKEN_KEY,
  MASTRA_INHERITED_MEMORY_KEY,
  MASTRA_MESSAGE_AUTHOR_KEY,
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_SCOPES_KEY,
  MASTRA_THREAD_ID_KEY,
  MASTRA_VERSIONS_KEY,
  RequestContext,
  isReservedRequestContextKey,
  mergeVersionOverrides,
} from '@internal/core/request-context';
export type { VersionOverrides, VersionSelector } from '@internal/core/request-context';

/**
 * Internal key carrying the tool-call IDs an `untilIdle` continuation turn reports
 * as finished, so message history can load their messages even when they fall
 * outside the history window.
 */
export const MASTRA_CONTINUATION_TOOL_CALL_IDS_KEY = '__mastra_continuationToolCallIds';
