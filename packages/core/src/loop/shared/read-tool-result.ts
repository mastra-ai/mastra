import type { MastraDBMessage, MessageList } from '../../agent/message-list';

/**
 * Walk messageList backwards looking for a tool-invocation part with the given
 * toolCallId in result state. Used to read the post-processToolResult value
 * back from the message list so processor mutations can be synced into the
 * downstream tool-result stream chunk (main loop) or the serialized step
 * output (durable loop).
 */
export function readToolResultFromMessageList(messageList: MessageList, toolCallId: string): unknown {
  const messages: MastraDBMessage[] = messageList.get.all.db();
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== 'assistant' || !msg.content?.parts) continue;
    for (const part of msg.content.parts) {
      if (
        part?.type === 'tool-invocation' &&
        part.toolInvocation?.toolCallId === toolCallId &&
        part.toolInvocation?.state === 'result'
      ) {
        return part.toolInvocation.result;
      }
    }
  }
  return undefined;
}
