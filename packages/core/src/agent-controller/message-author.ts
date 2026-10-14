import type { MastraProviderMetadata } from '../agent/message-list/state/types';
import type { MessageAuthor } from '../agent/signals';
import { MASTRA_MESSAGE_AUTHOR_KEY } from '../request-context';
import type { RequestContext } from '../request-context';

export type { MessageAuthor } from '../agent/signals';

export function readMessageAuthor(requestContext?: RequestContext): MessageAuthor | undefined {
  const value = requestContext?.get(MASTRA_MESSAGE_AUTHOR_KEY);
  if (!value || typeof value !== 'object') return undefined;
  const { id, name, avatarUrl } = value as Partial<Record<keyof MessageAuthor, unknown>>;
  if (typeof id !== 'string' || !id) return undefined;
  return {
    id,
    ...(typeof name === 'string' ? { name } : {}),
    ...(typeof avatarUrl === 'string' ? { avatarUrl } : {}),
  };
}

export function withMessageAuthor(
  providerOptions: MastraProviderMetadata | undefined,
  author: MessageAuthor | undefined,
): MastraProviderMetadata | undefined {
  if (!author) return providerOptions;
  return { ...providerOptions, mastra: { ...providerOptions?.mastra, author } };
}
