import type { MastraDBMessage, MessageList } from '../../agent/message-list';

/**
 * Read the result of the newest tool-invocation part with the given toolCallId,
 * or undefined if that part isn't in result state. Used to read the post-processToolResult value
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
      // Stop at the newest part with this id, the same part updateToolInvocation
      // writes to. Scanning past it would pick up an older turn's result when a
      // provider reuses tool call ids.
      if (part?.type === 'tool-invocation' && part.toolInvocation?.toolCallId === toolCallId) {
        return part.toolInvocation.state === 'result' ? part.toolInvocation.result : undefined;
      }
    }
  }
  return undefined;
}
