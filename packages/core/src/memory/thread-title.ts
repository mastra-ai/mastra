import type { MastraMemory } from './memory';
import { isThreadTitlePinned } from './types';
import type { MemoryConfigInternal, StorageThreadType } from './types';

type ThreadTitleState = Pick<StorageThreadType, 'title' | 'metadata'>;

export function channelPlaceholderTitle(platform: string): string {
  return `${platform} conversation`;
}

export function isChannelPlaceholderTitle({ title, metadata }: ThreadTitleState): boolean {
  const platform = metadata?.channel_platform;
  return typeof platform === 'string' && title === channelPlaceholderTitle(platform);
}

export function needsThreadTitle(thread: ThreadTitleState): boolean {
  if (isThreadTitlePinned(thread.metadata)) return false;
  return !thread.title || isChannelPlaceholderTitle(thread);
}

/**
 * Saves a generated title unless the thread was deleted or named while the model ran.
 * Never creates the thread, so a deleted thread is not resurrected (#25203).
 */
export async function saveGeneratedThreadTitle({
  memory,
  threadId,
  title,
  memoryConfig,
}: {
  memory: MastraMemory;
  threadId: string;
  title: string;
  memoryConfig?: MemoryConfigInternal;
}): Promise<boolean> {
  const thread = await memory.getThreadById({ threadId });
  if (!thread || !needsThreadTitle(thread)) return false;
  try {
    await memory.updateThread({ id: threadId, title, memoryConfig });
    return true;
  } catch (error) {
    // A delete can land between the read and the update.
    if (!(await memory.getThreadById({ threadId }))) return false;
    throw error;
  }
}
