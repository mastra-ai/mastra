import { isThreadTitlePinned } from '@mastra/core/memory';
import type { StorageThreadType } from '@mastra/core/memory';

/** Resolve an automatic title update against the latest stored thread, respecting manual renames. */
export function resolveThreadTitleUpdate(thread: StorageThreadType, proposedTitle?: string): string | undefined {
  if (isThreadTitlePinned(thread.metadata)) return undefined;
  const title = proposedTitle?.trim();
  return title && title.length >= 3 && title !== thread.title?.trim() ? title : undefined;
}
