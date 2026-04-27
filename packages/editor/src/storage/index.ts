/**
 * Re-export filesystem storage from @mastra/core/storage.
 *
 * FilesystemStore and related utilities have moved to @mastra/core.
 * This re-export is kept for backwards compatibility.
 *
 * @example
 * ```typescript
 * // Preferred:
 * import { FilesystemStore } from '@mastra/core/storage';
 *
 * // Also works (deprecated):
 * import { FilesystemStore } from '@mastra/editor/storage';
 * ```
 */
export {
  FilesystemStore,
  type FilesystemStoreConfig,
  FilesystemDB,
  FilesystemVersionedHelpers,
  GitHistory,
} from '@mastra/core/storage';
