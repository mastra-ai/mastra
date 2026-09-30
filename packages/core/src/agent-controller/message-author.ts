import type { MastraProviderMetadata } from '../agent/message-list/state/types';
import { MASTRA_MESSAGE_AUTHOR_KEY } from '../request-context';
import type { RequestContext } from '../request-context';

/** Who sent a user message, as stamped by the host that authenticated them. */
export type MessageAuthor = { id: string; name?: string; avatarUrl?: string };

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
