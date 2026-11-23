import type { MastraDBMessage, MessageList } from '@mastra/core/agent';

function tokenEstimateOf(part: unknown): unknown {
  return (part as { providerMetadata?: { mastra?: { tokenEstimate?: unknown } } } | undefined)?.providerMetadata?.mastra
    ?.tokenEstimate;
}

/**
 * Watch the stored history of `threadId` in `messageList` while OM counts it, so the counts can be saved with
 * the messages. Call the returned function once the counting is done: every message whose parts gained a token
 * estimate is marked for resave, and the normal save writes it back whole.
 *
 * Only messages of `threadId` are marked. A message recalled from another thread of the resource is counted but
 * never written, because saving it would bump that thread's `updatedAt` and reorder the recent-thread list.
 *
 * A Core without `markForResave` is left alone: counting still works, the counts are just not saved.
 */
export function resaveCountedMessagesFor(messageList: MessageList, threadId: string): () => void {
  if (typeof (messageList as Partial<MessageList>).markForResave !== 'function') return () => {};

  const before = new Map<MastraDBMessage, unknown[]>();
  for (const message of messageList.get.remembered.db()) {
    if (message.threadId !== threadId) continue;
    before.set(message, (message.content?.parts ?? []).map(tokenEstimateOf));
  }

  return () => {
    for (const [message, estimates] of before) {
      const parts = message.content?.parts ?? [];
      if (parts.some((part, index) => tokenEstimateOf(part) !== estimates[index])) messageList.markForResave(message);
    }
  };
}

/** The stored messages marked for resave in `messageList`; none for a Core without `markForResave`. */
export function messagesMarkedForResave(messageList: MessageList): MastraDBMessage[] {
  return typeof (messageList as Partial<MessageList>).getMessagesToResave === 'function'
    ? messageList.getMessagesToResave()
    : [];
}

/** `messages` with the messages marked for resave added, each message once. */
export function withMessagesMarkedForResave(messageList: MessageList, messages: MastraDBMessage[]): MastraDBMessage[] {
  const ids = new Set(messages.map(message => message.id));
  return [...messages, ...messagesMarkedForResave(messageList).filter(message => !ids.has(message.id))];
}
