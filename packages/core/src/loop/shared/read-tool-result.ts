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

/**
 * Fold a metadata-only `maxToolResultTokens` cap (if `processToolResult`
 * wrote one onto the tool-call step's local `messageList`) into the
 * `providerMetadata` that step returns, so the cap survives the durable
 * step boundary. Returns the (possibly merged) `providerMetadata` plus
 * whether a cap was actually found, which the caller carries as
 * `resultCapped` so `llm-mapping` knows not to recompute it.
 *
 * Pulled out of the durable `tool-call` step so this exact carry logic can
 * be exercised directly in tests without re-implementing it — see the
 * step-boundary threading test in token-limiter-agent.test.ts.
 */
export function carryCappedProviderMetadata(
  messageList: MessageList,
  toolCallId: string,
  providerMetadata: Record<string, unknown> | undefined,
): { providerMetadata: Record<string, unknown> | undefined; resultCapped: boolean } {
  const cappedProviderMetadata = readCappedProviderMetadataFromMessageList(messageList, toolCallId);
  if (!cappedProviderMetadata) {
    return { providerMetadata, resultCapped: false };
  }
  const existingMastra = (providerMetadata as { mastra?: Record<string, unknown> } | undefined)?.mastra;
  const cappedMastra = (cappedProviderMetadata as { mastra?: Record<string, unknown> }).mastra;
  return {
    providerMetadata: {
      ...providerMetadata,
      ...cappedProviderMetadata,
      mastra: { ...existingMastra, ...cappedMastra },
    },
    resultCapped: true,
  };
}
