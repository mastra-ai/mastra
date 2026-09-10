import { coreContentToString } from '../conversion';
import type { MessageList } from '../message-list';
import type { MastraDBMessage } from '../types';
import { convertMessages } from './convert-messages';

export function getProcessableResponseMessages(messageList: MessageList): MastraDBMessage[] {
  const liveMessages = messageList.get.response.db();
  const persistedMessages = messageList.getPersisted.response.db();

  if (persistedMessages.length === 0) {
    return [...liveMessages];
  }
  if (liveMessages.length === 0) {
    return [...persistedMessages];
  }

  const messagesById = new Map(persistedMessages.map(message => [message.id, message]));
  for (const message of liveMessages) {
    messagesById.set(message.id, message);
  }

  return messageList.get.all
    .db()
    .filter(message => messagesById.has(message.id))
    .map(message => messagesById.get(message.id)!);
}

/** Final response text, excluding tool results and completion-check feedback. */
export function responseText(messageList: MessageList): string {
  const messages = getProcessableResponseMessages(messageList).filter(
    message => message.role === 'assistant' && !message.content?.metadata?.completionResult,
  );
  return convertMessages(messages)
    .to('AIV4.Core')
    .filter(message => message.role === 'assistant')
    .map(message => coreContentToString(message.content))
    .join('');
}
