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
