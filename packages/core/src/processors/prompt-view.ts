import type { CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';
import type { MastraDBMessage } from '../agent/message-list';
import { MessageList } from '../agent/message-list';

export function stripPromptOnlySystemMessages(messages: readonly MastraDBMessage[]): MastraDBMessage[] {
  return messages.filter(message => message.role !== 'system');
}

export function normalizePromptOnlyMessages(
  messages: readonly MastraDBMessage[],
  { clone = true }: { clone?: boolean } = {},
): MastraDBMessage[] {
  const nonSystemMessages = stripPromptOnlySystemMessages(messages);

  if (!clone) {
    return nonSystemMessages;
  }

  return nonSystemMessages.map(message => structuredClone(message));
}

export function createPromptOnlyMessageList({
  canonicalMessageList,
  modelContextMessages,
  systemMessages,
  cloneMessages = true,
}: {
  canonicalMessageList: MessageList;
  modelContextMessages: readonly MastraDBMessage[];
  systemMessages?: CoreMessageV4[];
  cloneMessages?: boolean;
}): MessageList {
  const promptOnlyMessageList = new MessageList().deserialize(canonicalMessageList.serialize());
  promptOnlyMessageList.clear.all.db();

  const nonSystemMessages = normalizePromptOnlyMessages(modelContextMessages, { clone: cloneMessages });
  if (nonSystemMessages.length > 0) {
    promptOnlyMessageList.add(nonSystemMessages, 'input');
  }

  promptOnlyMessageList.replaceAllSystemMessages(systemMessages ?? canonicalMessageList.getAllSystemMessages());
  return promptOnlyMessageList;
}

export function snapshotMessageList(messageList: MessageList): string {
  return JSON.stringify(messageList.serialize());
}
