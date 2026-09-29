import type { MastraDBMessage, MessageList } from '../../agent/message-list';

type ToolInvocationPart = Extract<MastraDBMessage['content']['parts'][number], { type: 'tool-invocation' }>;

// The newest tool-invocation part with this id: the part updateToolInvocation
// writes to. Scanning past it would reach an older turn's part when a provider
// reuses tool call ids.
function findNewestToolInvocationPart(messageList: MessageList, toolCallId: string): ToolInvocationPart | undefined {
  const messages: MastraDBMessage[] = messageList.get.all.db();
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== 'assistant' || !msg.content?.parts) continue;
    for (const part of msg.content.parts) {
      if (part?.type === 'tool-invocation' && part.toolInvocation?.toolCallId === toolCallId) {
        return part;
      }
    }
  }
  return undefined;
}

export type ToolResultSnapshot = { part: ToolInvocationPart; result: unknown } | undefined;

/**
 * Snapshot an existing result for this id before processToolResult runs. A
 * same-stream provider result has no part of its own yet, so the newest part
 * with a reused id belongs to an earlier turn; pass the snapshot to
 * readToolResultFromMessageList so that part isn't read back as this result.
 */
export function snapshotToolResult(messageList: MessageList, toolCallId: string): ToolResultSnapshot {
  const part = findNewestToolInvocationPart(messageList, toolCallId);
  return part?.toolInvocation.state === 'result' ? { part, result: part.toolInvocation.result } : undefined;
}

/**
 * Read the post-processToolResult value back from the message list so processor
 * mutations can be synced into the downstream tool-result stream chunk (main
 * loop) or the serialized step output (durable loop). Returns undefined when
 * the newest part with this id isn't in result state, or is the unchanged
 * part captured in `before`.
 */
export function readToolResultFromMessageList(
  messageList: MessageList,
  toolCallId: string,
  before?: ToolResultSnapshot,
): unknown {
  const part = findNewestToolInvocationPart(messageList, toolCallId);
  if (part?.toolInvocation.state !== 'result') return undefined;
  if (before && part === before.part && part.toolInvocation.result === before.result) return undefined;
  return part.toolInvocation.result;
}
