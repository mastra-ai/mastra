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

// Written by @mastra/server auth (`MASTRA_USER_KEY` there) for authenticated requests.
const AUTHENTICATED_USER_KEY = 'mastra__user';

/**
 * Identifies the caller a thread subscription is bound to: the authenticated
 * user when the server set one, otherwise the host-stamped message author.
 */
export function readCallerId(requestContext?: RequestContext): string | undefined {
  const user = requestContext?.get(AUTHENTICATED_USER_KEY) as { id?: unknown } | undefined;
  if (user && typeof user === 'object' && typeof user.id === 'string' && user.id) return user.id;
  return readMessageAuthor(requestContext)?.id;
}

export function withMessageAuthor(
  providerOptions: MastraProviderMetadata | undefined,
  author: MessageAuthor | undefined,
): MastraProviderMetadata | undefined {
  if (!author) return providerOptions;
  return { ...providerOptions, mastra: { ...providerOptions?.mastra, author } };
}
