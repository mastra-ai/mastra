import type { GetMemoryConfigResponse } from '@mastra/client-js';

type MemoryConfig = NonNullable<GetMemoryConfigResponse['config']>;

export function getRecentMessagesSettings(
  lastMessages: MemoryConfig['lastMessages'],
  messageTokens?: MemoryConfig['messageTokens'],
) {
  const maxTokens = messageTokens?.maxTokens;
  const maxMessages = typeof lastMessages === 'number' ? lastMessages : undefined;
  const enabled = lastMessages !== false && maxMessages !== 0 && (maxMessages !== undefined || maxTokens !== undefined);

  if (!enabled) {
    return { enabled, maxMessages: undefined, description: 'Recent message history is not included in context.' };
  }

  const messageLabel = maxMessages === 1 ? 'message' : 'messages';
  const history =
    maxMessages === undefined ? 'Includes recent message history' : `Includes the last ${maxMessages} ${messageLabel}`;
  const description =
    maxTokens === undefined
      ? `${history} in context.`
      : `${history} with a ${maxTokens}-token context budget, trimming oldest history first.`;

  return { enabled, maxMessages, description };
}
