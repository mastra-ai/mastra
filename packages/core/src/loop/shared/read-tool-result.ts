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

/**
 * Walk messageList backwards looking for a tool-invocation part (in *any*
 * state, unlike `readToolResultFromMessageList`) with the given toolCallId
 * whose `providerMetadata.mastra.modelOutputCapped` flag is set. Used by the
 * durable `tool-call` step to carry `TokenLimiterProcessor`'s metadata-only
 * cap write across the step boundary: `processToolResult` hooks mutate the
 * step's local `MessageList` copy directly, but `llm-mapping` rebuilds the
 * transcript from the serialized step output, so a cap that only lives on
 * the messageList part is invisible unless it also travels on the return
 * value (see `resultCapped` on the durable tool-call output schema).
 */
export function readCappedProviderMetadataFromMessageList(
  messageList: MessageList,
  toolCallId: string,
): Record<string, unknown> | undefined {
  const messages: MastraDBMessage[] = messageList.get.all.db();
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== 'assistant' || !msg.content?.parts) continue;
    for (const part of msg.content.parts) {
      if (part?.type === 'tool-invocation' && part.toolInvocation?.toolCallId === toolCallId) {
        const mastra = (part.providerMetadata as { mastra?: Record<string, unknown> } | undefined)?.mastra;
        if (mastra && typeof mastra === 'object' && mastra.modelOutputCapped) {
          return part.providerMetadata as Record<string, unknown>;
        }
        return undefined;
      }
    }
  }
  return undefined;
}
