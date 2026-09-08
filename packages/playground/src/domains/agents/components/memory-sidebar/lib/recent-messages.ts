import type { GetMemoryConfigResponse } from '@mastra/client-js';

type LastMessages = NonNullable<GetMemoryConfigResponse['config']>['lastMessages'];

export function getRecentMessagesSettings(lastMessages: LastMessages) {
  const maxTokens = typeof lastMessages === 'object' ? lastMessages.maxTokens : undefined;
  const maxMessages =
    typeof lastMessages === 'object'
      ? (lastMessages.maxMessages ?? (maxTokens === undefined ? 10 : undefined))
      : typeof lastMessages === 'number'
        ? lastMessages
        : undefined;
  const enabled = lastMessages !== false && lastMessages !== undefined && maxMessages !== 0;

  if (!enabled) {
    return { enabled, maxMessages: undefined, description: 'Recent message history is not included in context.' };
  }

  const messageLabel = maxMessages === 1 ? 'message' : 'messages';
  const history =
    maxMessages === undefined ? 'Includes recent message history' : `Includes the last ${maxMessages} ${messageLabel}`;
  const budget =
    maxTokens === undefined
      ? 'in context.'
      : `with a ${maxTokens}-token context budget, trimming oldest history first.`;
  return { enabled, maxMessages, description: `${history} ${budget}` };
}
