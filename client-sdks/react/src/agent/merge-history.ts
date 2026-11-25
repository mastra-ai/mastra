import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { CLIENT_MESSAGE_ID_KEY } from '../lib/mastra-db';
import { isRecord } from './extract-tasks';

const liveClientMessageId = (message: MastraDBMessage): string | undefined => {
  const clientMessageId = message.content.metadata?.[CLIENT_MESSAGE_ID_KEY];
  return typeof clientMessageId === 'string' ? clientMessageId : undefined;
};

// A stored user signal keeps the sender's metadata under `metadata.signal.metadata`.
const storedClientMessageId = (message: MastraDBMessage): string | undefined => {
  const signal = message.content.metadata?.signal;
  const clientMessageId =
    isRecord(signal) && isRecord(signal.metadata) ? signal.metadata[CLIENT_MESSAGE_ID_KEY] : undefined;
  return typeof clientMessageId === 'string' ? clientMessageId : undefined;
};

export const mergeHistoryIntoConversation = ({
  conversation,
  history,
  previousHistory,
}: {
  conversation: MastraDBMessage[];
  history: MastraDBMessage[];
  previousHistory: MastraDBMessage[];
}): MastraDBMessage[] => {
  const previousById = new Map(previousHistory.map(message => [message.id, message]));
  const live = conversation.filter(message => previousById.get(message.id) !== message);
  const liveById = new Map(live.map(message => [message.id, message]));
  const liveClientMessageIds = new Set(live.flatMap(message => liveClientMessageId(message) ?? []));
  const historyIds = new Set(history.map(message => message.id));
  const storedClientMessageIds = new Set(history.flatMap(message => storedClientMessageId(message) ?? []));

  const mergedHistory = history.map(message => {
    const liveCopy = liveById.get(message.id);
    if (liveCopy) return liveCopy;
    const clientMessageId = storedClientMessageId(message);
    if (!clientMessageId || !liveClientMessageIds.has(clientMessageId)) return message;
    // Rows key on the client id; keeping it stops the user row remounting mid-answer.
    return {
      ...message,
      content: {
        ...message.content,
        metadata: { ...message.content.metadata, [CLIENT_MESSAGE_ID_KEY]: clientMessageId },
      },
    };
  });
  const unstoredLive = live.filter(message => {
    const clientMessageId = liveClientMessageId(message);
    return !historyIds.has(message.id) && !(clientMessageId && storedClientMessageIds.has(clientMessageId));
  });

  return [...mergedHistory, ...unstoredLive];
};

/**
 * Catches a conversation up with the stored history a resubscription starts with, once the page lost its thread
 * stream (a phone locked, the network gone). The server sends that history, then only the parts newer than it, the
 * running reply's included. Of the range the history covers, the page shows what a reload would: the stored copies,
 * which keep the client id of the page's rows. Messages older than the history page stay where they are, messages
 * still on their way to the server come after it, and what the page streamed of the running reply that the server
 * has not stored goes, as the server sends it again.
 */
export const catchUpWithHistory = ({
  conversation,
  history,
  activeRunId,
}: {
  conversation: MastraDBMessage[];
  history: MastraDBMessage[];
  /** The run the history names as running: the server sends again what it has not stored of it. */
  activeRunId?: string | null;
}): MastraDBMessage[] => {
  // The page's copy of each stored message, by its id or by the client id the server stored it with.
  const pageCopies = new Map<string, MastraDBMessage>();
  for (const message of conversation) {
    pageCopies.set(message.id, message);
    const clientMessageId = liveClientMessageId(message);
    if (clientMessageId) pageCopies.set(clientMessageId, message);
  }
  const pageCopyOf = (stored: MastraDBMessage) => {
    const clientMessageId = storedClientMessageId(stored);
    return pageCopies.get(stored.id) ?? (clientMessageId ? pageCopies.get(clientMessageId) : undefined);
  };
  const storedPageCopies = new Set(history.flatMap(stored => pageCopyOf(stored) ?? []));
  const isStored = (message: MastraDBMessage) => storedPageCopies.has(message);
  // Sent, but not confirmed by the server yet: it comes after all the server stored.
  const isOnItsWay = (message: MastraDBMessage) => message.content.metadata?.status === 'pending' && !isStored(message);

  // What the page streamed of the running reply and the server has not stored: the server sends it again.
  const isSentAgain = (message: MastraDBMessage) =>
    !!activeRunId &&
    message.role === 'assistant' &&
    message.content.metadata?.runId === activeRunId &&
    !isStored(message);

  const firstStored = conversation.findIndex(isStored);
  // Older than the history page: the page keeps them where they are.
  const older = (firstStored === -1 ? conversation : conversation.slice(0, firstStored)).filter(
    message => !isOnItsWay(message) && !isSentAgain(message),
  );
  const stored = history.map(message => {
    const pageCopy = pageCopyOf(message);
    const clientMessageId = pageCopy && liveClientMessageId(pageCopy);
    if (!clientMessageId) return message;
    // Rows key on the client id; keeping it stops the user row remounting.
    return {
      ...message,
      content: {
        ...message.content,
        metadata: { ...message.content.metadata, [CLIENT_MESSAGE_ID_KEY]: clientMessageId },
      },
    };
  });
  return [...older, ...stored, ...conversation.filter(isOnItsWay)];
};
