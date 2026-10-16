import { isThreadTitlePinned } from './types';
import type { StorageThreadType } from './types';

/** Whether automatic naming may replace an empty title or a channel placeholder. */
export function needsThreadTitle(thread: Pick<StorageThreadType, 'title' | 'metadata'>): boolean {
  if (isThreadTitlePinned(thread.metadata)) return false;
  if (!thread.title) return true;

  // Keep the channel's fallback label until generation succeeds. Require channel
  // metadata so an ordinary user's title is never mistaken for a placeholder.
  const platform = thread.metadata?.channel_platform;
  return typeof platform === 'string' && platform.length > 0 && thread.title === `${platform} conversation`;
}
