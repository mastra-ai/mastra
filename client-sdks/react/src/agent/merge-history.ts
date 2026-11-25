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
 * stream (a phone locked, the network gone). The server then sends only the parts newer than that history: its
 * stored copies replace the page's, and what the page streamed that it has not stored is dropped, as the server
 * sends it again. Messages older than the history page stay, and so do messages still on their way to the server.
 */
export const catchUpWithHistory = ({
  conversation,
  history,
}: {
  conversation: MastraDBMessage[];
  history: MastraDBMessage[];
}): MastraDBMessage[] => {
  if (history.length === 0) return conversation;
  const historyIds = new Set(history.map(message => message.id));
  const storedClientMessageIds = new Set(history.flatMap(message => storedClientMessageId(message) ?? []));
  const isStored = (message: MastraDBMessage) => {
    const clientMessageId = liveClientMessageId(message);
    return historyIds.has(message.id) || (clientMessageId !== undefined && storedClientMessageIds.has(clientMessageId));
  };
  const firstStored = conversation.findIndex(isStored);
  const older = firstStored === -1 ? conversation : conversation.slice(0, firstStored);
  const caughtUp = firstStored === -1 ? [] : conversation.slice(firstStored);
  const liveClientMessageIds = new Set(caughtUp.flatMap(message => liveClientMessageId(message) ?? []));
  const liveById = new Map(caughtUp.map(message => [message.id, message]));

  const stored = history.map(message => {
    const storedId = storedClientMessageId(message);
    const clientMessageId =
      storedId && liveClientMessageIds.has(storedId)
        ? storedId
        : liveClientMessageId(liveById.get(message.id) ?? message);
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
  const onTheirWay = caughtUp.filter(message => liveClientMessageId(message) !== undefined && !isStored(message));

  return [...older, ...stored, ...onTheirWay];
};
