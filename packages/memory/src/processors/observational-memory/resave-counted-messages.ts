import type { MastraDBMessage, MessageList } from '@mastra/core/agent';

import { hasUnsavedTokenEstimate, markTokenEstimateSaved } from './token-counter';

/**
 * Mark the stored history of `threadId` in `messageList` that OM gave new token counts, so the counts are saved
 * with the messages. Call the returned function once the counting is done: every message holding a part that
 * gained a count in this process is marked for resave, and the normal save writes it back whole. Counts made
 * before this is called (while the turn loaded history) are caught too.
 *
 * Only messages of `threadId` are marked. A message recalled from another thread of the resource is counted but
 * never written, because saving it would bump that thread's `updatedAt` and reorder the recent-thread list.
 *
 * A Core without `markForResave` is left alone: counting still works, the counts are just not saved.
 */
export function resaveCountedMessagesFor(messageList: MessageList, threadId: string): () => void {
  if (typeof (messageList as Partial<MessageList>).markForResave !== 'function') return () => {};

  return () => {
    for (const message of messageList.get.remembered.db()) {
      if (message.threadId !== threadId) continue;
      const parts = message.content?.parts ?? [];
      if (!parts.some(hasUnsavedTokenEstimate)) continue;
      messageList.markForResave(message);
      parts.forEach(markTokenEstimateSaved);
    }
  };
}

/** The stored messages marked for resave in `messageList`; none for a Core without `markForResave`. */
export function messagesMarkedForResave(messageList: MessageList): MastraDBMessage[] {
  return typeof (messageList as Partial<MessageList>).getMessagesToResave === 'function'
    ? messageList.getMessagesToResave()
    : [];
}

/**
 * Ids of the stored messages marked for resave in `messageList` that are not in `ownMessages` (the turn's
 * own input and output). Those are saved whole; the rest only gained counts and are patched onto storage.
 */
export function idsMarkedForResave(messageList: MessageList, ownMessages: MastraDBMessage[] = []): Set<string> {
  const own = new Set(ownMessages.map(message => message.id));
  return new Set(
    messagesMarkedForResave(messageList)
      .map(message => message.id)
      .filter(id => !own.has(id)),
  );
}

/** `messages` with the messages marked for resave added, each message once. */
export function withMessagesMarkedForResave(messageList: MessageList, messages: MastraDBMessage[]): MastraDBMessage[] {
  const ids = new Set(messages.map(message => message.id));
  return [...messages, ...messagesMarkedForResave(messageList).filter(message => !ids.has(message.id))];
}
