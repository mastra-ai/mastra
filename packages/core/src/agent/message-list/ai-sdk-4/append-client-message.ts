import type { Message } from './types';

/**
 * Appends a client message to the messages array.
 * If the last message in the array has the same id as the new message, it will be replaced.
 * Otherwise, the new message will be appended.
 */
export function appendClientMessage({ messages, message }: { messages: Message[]; message: Message }) {
  return [
    ...(messages.length > 0 && messages[messages.length - 1]?.id === message.id ? messages.slice(0, -1) : messages),
    message,
  ];
}
